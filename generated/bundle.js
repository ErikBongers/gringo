(function() {
	//#region libs/Emmeter/tokenizer/PeekingTokenizer.ts
	var PeekingTokenizer$1 = class {
		tokenizer;
		constructor(tokenizer) {
			this.tokenizer = tokenizer;
		}
		next() {
			return this.tokenizer.next();
		}
		peek() {
			return this.tokenizer.clone().next();
		}
		peekSecond() {
			let clone = this.tokenizer.clone();
			clone.next();
			return clone.next();
		}
	};
	//#endregion
	//#region libs/Emmeter/tokenizer/cursor.ts
	var Cursor$1 = class Cursor$1 {
		text;
		currentPos;
		length;
		constructor(text) {
			this.text = text;
			this.length = this.text.length;
			this.currentPos = -1;
		}
		static copy(cursor) {
			let newCursor = new Cursor$1(cursor.text);
			newCursor.currentPos = cursor.currentPos;
			return newCursor;
		}
		eat(char) {
			if (this.currentPos >= this.length) return false;
			if (this.text[this.currentPos] == char) {
				this.currentPos++;
				return true;
			}
			return false;
		}
		get pos() {
			return this.currentPos;
		}
		get current() {
			if (this.currentPos >= this.length) return "";
			return this.text[this.currentPos];
		}
		next() {
			if (this.currentPos >= this.length) return "";
			this.currentPos++;
			return this.current;
		}
		peek() {
			if (this.currentPos + 1 >= this.length) return "";
			return this.text[this.currentPos + 1];
		}
		getText(pos, length) {
			return this.text.substring(pos, pos + length);
		}
		getTo(endChar, allowEscape = false) {
			let start = this.currentPos + 1;
			let end = start;
			while (end < this.length && (this.text[end] != endChar || this.text[end - 1] == "'")) end++;
			if (end == this.length) return null;
			this.currentPos = end;
			return {
				start,
				length: this.currentPos - start + 1
			};
		}
		getToNot(notChar) {
			let start = this.currentPos + 1;
			let end = start;
			while (end < this.length && (this.text[end] == notChar || this.text[end - 1] == "'")) end++;
			if (end == this.length) return null;
			if (end == start) return null;
			this.currentPos = end - 1;
			return {
				start,
				length: this.currentPos - start + 1
			};
		}
		getLocation(pos) {
			let line = 1;
			let col = 1;
			for (let i = 0; i < pos; i++) if (this.text[i] == "\n") {
				line++;
				col = 1;
			} else col++;
			return {
				line,
				col
			};
		}
		getLine(pos) {
			let loc = this.getLocation(pos);
			let start = 0;
			let end = this.length;
			for (let i = 0; i < this.length; i++) if (this.text[i] == "\n") if (loc.line > 1) {
				start = i + 1;
				loc.line--;
			} else {
				end = i;
				break;
			}
			return this.text.substring(start, end);
		}
	};
	//#endregion
	//#region libs/Emmeter/tokenizer/indentTokenizer.ts
	function getText$1(token) {
		return token.cursor.getText(token.pos, token.length);
	}
	var IndentTokenizer = class IndentTokenizer {
		cursor;
		constructor(text) {
			this.cursor = new Cursor$1(text);
		}
		setCursor(cursor) {
			this.cursor = cursor;
		}
		cloneCursor() {
			return Cursor$1.copy(this.cursor);
		}
		clone() {
			let theClone = new IndentTokenizer("");
			theClone.setCursor(this.cloneCursor());
			return theClone;
		}
		next() {
			let char = this.cursor.next();
			let found;
			let id = this.eatId(char);
			if (id) return id;
			let num = this.eatInteger(char);
			if (num) return num;
			switch (char) {
				case "": return null;
				case "\n":
					found = this.cursor.getToNot(" ");
					if (found) return {
						type: "INDENT",
						cursor: this.cursor,
						pos: found.start,
						length: found.length
					};
					return null;
				case " ":
					this.skipSpaces();
					return this.next();
				case ">":
				case "+":
				case "[":
				case "]":
				case "(":
				case ")":
				case "*":
				case ".":
				case "=":
				case "#": return {
					type: char,
					cursor: this.cursor,
					pos: this.cursor.pos,
					length: 1
				};
				case "{":
					found = this.cursor.getTo("}");
					if (found) return {
						type: "TEXT",
						cursor: this.cursor,
						pos: found.start,
						length: found.length - 1
					};
					return null;
				case "\"":
					found = this.cursor.getTo("\"");
					if (found) return {
						type: "STRING",
						cursor: this.cursor,
						pos: found.start,
						length: found.length - 1
					};
				default: return {
					type: "UNKNOWN",
					cursor: this.cursor,
					pos: this.cursor.pos,
					length: 1
				};
			}
		}
		eatId(char) {
			let pos = this.cursor.pos;
			if (char.match(/[a-zA-Z\-]/)) {
				while (this.cursor.peek().match(/[a-zA-Z0-9_\-]/)) this.cursor.next();
				return {
					type: "ID",
					cursor: this.cursor,
					pos,
					length: this.cursor.pos - pos + 1
				};
			}
			return null;
		}
		eatInteger(char) {
			let pos = this.cursor.pos;
			if (char.match(/[0-9]/)) {
				while (this.cursor.peek().match(/[0-9]/)) this.cursor.next();
				return {
					type: "NUMBER",
					cursor: this.cursor,
					pos,
					length: this.cursor.pos - pos + 1
				};
			}
			return null;
		}
		getNumberToken() {
			let token = {
				type: "NUMBER",
				cursor: this.cursor,
				pos: this.cursor.pos,
				length: 0
			};
			let start = this.cursor.pos;
			while (this.cursor.peek().match(/[0-9.,]/)) this.cursor.next();
			token.length = this.cursor.pos - start + 1;
			return token;
		}
		skipSpaces() {
			while (this.cursor.peek() == " ") this.cursor.next();
		}
	};
	//#endregion
	//#region libs/Emmeter/tokenizer/FilteredTokenizer.ts
	var FilteredTokenizer = class FilteredTokenizer {
		tokenizer;
		exclude;
		constructor(tokenizer, exclude) {
			this.tokenizer = tokenizer;
			this.exclude = exclude;
		}
		next() {
			let token = this.tokenizer.next();
			if (token && !this.exclude(token)) return this.next();
			return token;
		}
		clone() {
			return new FilteredTokenizer(this.tokenizer.clone(), this.exclude);
		}
	};
	//#endregion
	//#region libs/Emmeter/parser.ts
	var Parser$1 = class {
		tok;
		constructor(tok) {
			this.tok = tok;
		}
		parse() {
			let res = this.parsePlus(0);
			let next = this.tok.next();
			if (next) this.throwAt(`Unexpected token: ${next.type}`, next);
			return res;
		}
		eatEmptyLinesAndPeek() {
			while (true) {
				let token = this.tok.peek();
				if (token?.type == "INDENT" && this.tok.peekSecond()?.type == "INDENT") this.tok.next();
				else return token;
			}
		}
		parsePlus(currentIndent) {
			let list = [];
			while (true) {
				let el = this.parseMult(currentIndent);
				if (!el) return list.length === 1 ? list[0] : { list };
				list.push(el);
				if (this.match("+")) continue;
				let indentToken = this.eatEmptyLinesAndPeek();
				if (indentToken?.type == "INDENT" && indentToken?.length == currentIndent) {
					this.tok.next();
					continue;
				}
				return list.length === 1 ? list[0] : { list };
			}
		}
		parseMult(currentIndent) {
			let el = this.parseElementGroup(currentIndent);
			if (!el) return el;
			let starToken = this.match("*");
			if (starToken) {
				let mustBeNumber = this.tok.next();
				if (!mustBeNumber) this.throwAt("Number expecting after multiplier symbol '*'", starToken);
				return {
					count: parseInt(getText$1(mustBeNumber)),
					child: el
				};
			} else return el;
		}
		parseElementGroup(currentIndent) {
			let el;
			if (this.match("(")) {
				el = this.parsePlus(currentIndent);
				if (!this.match(")")) this.throwAt("Expected ')'", this.tok.peek());
				return el;
			}
			let indentToken = this.eatEmptyLinesAndPeek();
			if (indentToken?.type == "INDENT") {
				if (indentToken.length > currentIndent) {
					this.tok.next();
					return this.parsePlus(indentToken.length);
				}
			}
			let textToken = this.match("TEXT");
			if (textToken) return { text: getText$1(textToken) };
			else return this.parseElement(currentIndent);
		}
		parseElement(currentIndent) {
			let tag = this.tok.next();
			let id = void 0;
			let atts = [];
			let classList = [];
			let innerText = void 0;
			if (!tag) this.throwAt("Unexpected end of stream. Tag expected.", tag);
			while (this.tok.peek()) {
				if (this.match(".")) {
					let className = this.tok.next();
					if (!className) this.throwAt("Unexpected end of stream. Class name expected.", className);
					classList.push(getText$1(className));
					continue;
				}
				if (this.match("[")) {
					atts = this.parseAttributes(currentIndent);
					continue;
				}
				if (this.match("#")) {
					let idToken = this.tok.next();
					if (!idToken) this.throwAt("Unexpected end of stream. ID expected.", idToken);
					id = getText$1(idToken);
					continue;
				}
				let textToken = this.match("TEXT");
				if (textToken) {
					innerText = getText$1(textToken);
					continue;
				}
				break;
			}
			return {
				tag: getText$1(tag),
				id,
				atts,
				classList,
				innerText,
				child: this.parseDown(currentIndent)
			};
		}
		parseDown(currentIndent) {
			if (this.match(">")) return this.parsePlus(currentIndent);
			let indentToken = this.eatEmptyLinesAndPeek();
			if (indentToken?.type == "INDENT" && indentToken?.length > currentIndent) {
				this.tok.next();
				return this.parsePlus(indentToken?.length);
			}
		}
		parseAttributes(currentIndent) {
			let attDefs = [];
			while (true) {
				if (this.match("]")) break;
				let att = this.parseAttribute(currentIndent);
				if (att) attDefs.push(att);
				else break;
			}
			return attDefs;
		}
		parseAttribute(currentIndent) {
			let nameToken = this.tok.next();
			if (!nameToken) return null;
			let name = getText$1(nameToken);
			if (name[0] === ",") this.throwAt("Unexpected ',' - don't separate attributes with ','.", nameToken);
			let eq = this.tok.next();
			if (!eq) this.throwAt("Unexpected end of stream. '=' expected.", eq);
			let subToken;
			let sub = "";
			if (eq.type === ".") {
				subToken = this.tok.next();
				if (subToken) sub = getText$1(subToken);
				eq = this.tok.next();
			}
			if (eq?.type != "=") this.throwAt("Equal sign expected.", eq);
			let valueToken = this.tok.next();
			if (!valueToken) this.throwAt("Value expected", valueToken);
			if (valueToken.type != "STRING" && valueToken.type != "NUMBER") this.throwAt(`Value should be STRING or NUMBER. Found ${valueToken.type}.`, valueToken);
			let value = getText$1(valueToken);
			if (value[0] === "\"") value = this.stripStringDelimiters(value);
			return {
				name,
				sub,
				value
			};
		}
		match(expected) {
			if (this.tok.peek()?.type == expected) return this.tok.next();
			return null;
		}
		stripStringDelimiters(text) {
			if (text[0] === "'" || text[0] === "\"" || text[0] === "{") return text.substring(1, text.length - 1);
			return text;
		}
		printLocation(token) {
			let { line, col } = token.cursor.getLocation(token.pos);
			return `line ${line}, col ${col}\n${token.cursor.getLine(token.pos)}\n${" ".repeat(col - 1)}^`;
		}
		throwAt(mesagee, token) {
			if (token) throw new Error(`${mesagee}\n  at ${this.printLocation(token)}`);
			else throw new Error(`${mesagee}\n  at EOF`);
		}
	};
	//#endregion
	//#region libs/Emmeter/html.ts
	let emmet = {
		createElement,
		append,
		insertBefore,
		insertAfter,
		appendChild,
		indent: {
			createElement: createElement_indent,
			append: append_indent,
			insertBefore: insertBefore_indent,
			insertAfter: insertAfter_indent,
			appendChild: appendChild_indent
		}
	};
	let lastCreated = void 0;
	function createElement(text, onIndex, hook) {
		return createOnTempParent(new PeekingTokenizer$1(new FilteredTokenizer(new IndentTokenizer(text), (t) => t.type != "INDENT")), onIndex, hook);
	}
	function createElement_indent(text, onIndex, hook) {
		return createOnTempParent(new PeekingTokenizer$1(new IndentTokenizer(text)), onIndex, hook);
	}
	function createOnTempParent(tok, onIndex, hook) {
		let first = insertAt(tok, "beforeend", document.createElement("div"), onIndex, hook).first;
		first.remove();
		return first;
	}
	function append(root, text, onIndex, hook) {
		return parseAndBuild(createTokenizer(text), root, onIndex, hook);
	}
	function append_indent(root, text, onIndex, hook) {
		return parseAndBuild(createIndentTokenizer(text), root, onIndex, hook);
	}
	function insertBefore(target, text, onIndex, hook) {
		return insertAt(createTokenizer(text), "beforebegin", target, onIndex, hook);
	}
	function insertBefore_indent(target, text, onIndex, hook) {
		return insertAt(createIndentTokenizer(text), "beforebegin", target, onIndex, hook);
	}
	function insertAfter(target, text, onIndex, hook) {
		return insertAt(createTokenizer(text), "afterend", target, onIndex, hook);
	}
	function insertAfter_indent(target, text, onIndex, hook) {
		return insertAt(createIndentTokenizer(text), "afterend", target, onIndex, hook);
	}
	function appendChild(parent, text, onIndex, hook) {
		return insertAt(createTokenizer(text), "beforeend", parent, onIndex, hook);
	}
	function appendChild_indent(parent, text, onIndex, hook) {
		return insertAt(createIndentTokenizer(text), "beforeend", parent, onIndex, hook);
	}
	function insertAt(tok, position, target, onIndex, hook) {
		let tempRoot = document.createElement("div");
		let result = parseAndBuild(tok, tempRoot, onIndex, hook);
		let first = null;
		let insertPos = target;
		let children = [...tempRoot.childNodes];
		for (let child of children) if (!first) if (child.nodeType === Node.TEXT_NODE) first = insertPos = insertAdjacentText(target, position, child.wholeText);
		else first = insertPos = target.insertAdjacentElement(position, child);
		else if (child.nodeType === Node.TEXT_NODE) insertPos = insertPos.parentElement.insertBefore(document.createTextNode(child.wholeText), insertPos.nextSibling);
		else insertPos = insertPos.parentElement.insertBefore(child, insertPos.nextSibling);
		return {
			target,
			first,
			last: result.last
		};
	}
	function insertAdjacentText(target, position, text) {
		switch (position) {
			case "beforebegin": return target.parentElement.insertBefore(document.createTextNode(text), target);
			case "afterbegin": return target.insertBefore(document.createTextNode(text), target.firstChild);
			case "beforeend": return target.appendChild(document.createTextNode(text));
			case "afterend": return target.parentElement.appendChild(document.createTextNode(text));
		}
	}
	function createTokenizer(text) {
		return new PeekingTokenizer$1(new FilteredTokenizer(new IndentTokenizer(text), (t) => t.type != "INDENT"));
	}
	function createIndentTokenizer(text) {
		return new PeekingTokenizer$1(new IndentTokenizer(text));
	}
	function parseAndBuild(tok, root, onIndex, hook) {
		buildElement(root, new Parser$1(tok).parse(), 1, onIndex, hook);
		return {
			root,
			last: lastCreated
		};
	}
	function buildElement(parent, el, index, onIndex, hook) {
		if ("tag" in el) {
			let created = appendChildElement(parent, el, index, onIndex, hook);
			if (el.child) buildElement(created, el.child, index, onIndex, hook);
			return;
		}
		if ("list" in el) for (let def of el.list) buildElement(parent, def, index, onIndex, hook);
		if ("count" in el) for (let i = 0; i < el.count; i++) buildElement(parent, el.child, i, onIndex, hook);
		if ("text" in el) {
			parent.appendChild(document.createTextNode(addIndex(el.text, index, onIndex)));
			return;
		}
	}
	function addIndex(text, index, onIndex) {
		if (onIndex) {
			let result = onIndex(index);
			text = text.replace("$$", result);
		}
		return text.replace("$", (index + 1).toString());
	}
	function appendChildElement(parent, def, index, onIndex, hook) {
		let el = parent.appendChild(document.createElement(def.tag));
		if (def.id) el.id = addIndex(def.id, index, onIndex);
		for (let clazz of def.classList) el.classList.add(addIndex(clazz, index, onIndex));
		for (let att of def.atts) if (att.sub) el[addIndex(att.name, index, onIndex)][addIndex(att.sub, index, onIndex)] = addIndex(att.value, index, onIndex);
		else el.setAttribute(addIndex(att.name, index, onIndex), addIndex(att.value, index, onIndex));
		if (def.innerText) el.appendChild(document.createTextNode(addIndex(def.innerText, index, onIndex)));
		lastCreated = el;
		if (hook) hook(el);
		return el;
	}
	//#endregion
	//#region typescript/def.ts
	const JSON_URL = "https://europe-west1-ebo-tain.cloudfunctions.net/json";
	const JSON_SINCE_URL = "https://europe-west1-ebo-tain.cloudfunctions.net/json-since";
	const KEY_LAST_FETCHED_METAS = "gringo.lastFetchedMetas";
	const KEY_CLOUD_GRINGO_FOLDER = "gringo/";
	const KEY_CLOUD_PR_FOLDER = KEY_CLOUD_GRINGO_FOLDER + "pr/";
	const BTW_TARIFS_FILENAME = KEY_CLOUD_GRINGO_FOLDER + "btwTarifs.json";
	const GLOBAL_SETTINGS_FILENAME = KEY_CLOUD_GRINGO_FOLDER + "gringo_global_settings.json";
	const KEY_CLOUD_METAS_FOLDER = KEY_CLOUD_PR_FOLDER + "meta/";
	const KEY_ALL_PRS_FILENAME_NOEXT = KEY_CLOUD_PR_FOLDER + "allPrs";
	//#endregion
	//#region typescript/cloud.ts
	let cloud = { json: {
		fetch: fetchJson,
		fetchSince: fetchJsonSince,
		upload: uploadJson
	} };
	async function fetchJson(fileName) {
		return fetch(JSON_URL + "?fileName=" + fileName, { method: "GET" }).then((res) => res.json());
	}
	async function uploadJson(fileName, data) {
		return await (await fetch(JSON_URL + "?fileName=" + fileName, {
			method: "POST",
			body: JSON.stringify(data),
			keepalive: true
		})).text();
	}
	async function fetchJsonSince(folderName, zTimeStamp) {
		return (await fetch(JSON_SINCE_URL + "?folderName=" + folderName + "&changedSince=" + zTimeStamp, { method: "GET" })).json();
	}
	//#endregion
	//#region typescript/plugin_options/options.ts
	const options = { showDebug: false };
	let defaultGlobalSettings = {
		projects: [],
		tagDefs: structuredClone([{
			name: "BB>",
			description: "Bestelbon verzonden",
			color: "",
			bkgColor: "orange",
			order: 0
		}, {
			name: "✔",
			description: "Bestelling ontvangen",
			color: "green",
			bkgColor: "",
			order: 100
		}])
	};
	let globalSettings = null;
	async function getGlobalSettingsCached() {
		if (globalSettings) return globalSettings;
		return await fetchGlobalSettings();
	}
	function setGlobalSetting(settings) {
		globalSettings = settings;
	}
	async function fetchGlobalSettings() {
		return await cloud.json.fetch(GLOBAL_SETTINGS_FILENAME).catch((err) => {
			console.log(err);
			return defaultGlobalSettings;
		});
	}
	//#endregion
	//#region typescript/globals.ts
	let observers = [];
	let settingsObservers = [];
	function registerObserver(observer) {
		observers.push(observer);
		if (observers.length > 20) console.error("Too many observers!");
	}
	function createHtmlTable(headers, cols) {
		let tmpDiv = document.createElement("div");
		let { first: tmpTable, last: tmpThead } = emmet.appendChild(tmpDiv, "table>thead");
		for (let th of headers) emmet.appendChild(tmpThead, `th{${th}}`);
		let tmpTbody = tmpTable.appendChild(document.createElement("tbody"));
		for (let tr of cols) {
			let tmpTr = tmpTbody.appendChild(document.createElement("tr"));
			for (let cell of tr) emmet.appendChild(tmpTr, `td{${cell}}`);
		}
		return tmpTable;
	}
	async function getOptions() {
		let items = await chrome.storage.sync.get(null);
		Object.assign(options, items);
		setGlobalSetting(await fetchGlobalSettings());
	}
	function escapeRegexChars(text) {
		return text.replaceAll("\\", "\\\\").replaceAll("^", "\\^").replaceAll("$", "\\$").replaceAll(".", "\\.").replaceAll("|", "\\|").replaceAll("?", "\\?").replaceAll("*", "\\*").replaceAll("+", "\\+").replaceAll("(", "\\(").replaceAll(")", "\\)").replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll("{", "\\{").replaceAll("}", "\\}");
	}
	function tryUntilThen(func, then) {
		if (func()) then();
		else setTimeout(() => tryUntilThen(func, then), 100);
	}
	function gringo(...args) {
		console.log("gringo", ...args);
	}
	function getAndSetFlag(el, flag) {
		let value = el.dataset["gringo" + flag] == "true";
		el.dataset["gringo" + flag] = "true";
		return value;
	}
	function getAndSetDecorated(el) {
		return getAndSetFlag(el, "Decorated");
	}
	function createInfoBlock(el) {
		emmet.appendChild(el, `
        div.infoBlock>(
            h2.title+
            div.errors+
            div.info+
            div.extra
        )
    `);
		return {
			title: el.querySelector("h2.title"),
			errors: el.querySelector("div.errors"),
			info: el.querySelector("div.info"),
			extra: el.querySelector("div.extra")
		};
	}
	let priceFormatter$1 = new Intl.NumberFormat("nl-BE", {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2
	});
	function formatPrice(price, currencySymbol = "€", currency = "") {
		return `${currencySymbol} ${priceFormatter$1.format(price)} ${currency}`.trim();
	}
	//#endregion
	//#region typescript/pageObserver.ts
	var PartialUrlPageFilter = class {
		partialUrl;
		constructor(partialUrl) {
			this.partialUrl = partialUrl;
		}
		match() {
			return window.location.href.includes(this.partialUrl);
		}
	};
	var BaseObserver = class {
		onPageChangedCallback;
		onPageRefreshedCallback;
		pageFilter;
		onMutation;
		observer = null;
		trackModal;
		constructor(onPageChangedCallback, pageFilter, onMutationCallback, trackModal = false, onPageRefreshedCallback) {
			this.onPageChangedCallback = onPageChangedCallback;
			this.onPageRefreshedCallback = onPageRefreshedCallback;
			this.pageFilter = pageFilter;
			this.onMutation = onMutationCallback;
			this.trackModal = trackModal;
			if (onMutationCallback) this.observer = new MutationObserver((mutationList, observer) => this.observerCallback(mutationList, observer));
		}
		observerCallback(mutationList, _observer) {
			if (!this.onMutation) return;
			for (const mutation of mutationList) {
				if (mutation.type !== "childList") continue;
				if (this.onMutation(mutation)) break;
			}
		}
		isPageMatching = () => this.pageFilter.match();
		onPageRefreshed() {
			if (this.onPageRefreshedCallback) {
				if (this.isPageMatching()) tryUntilThen(this.isPageReallyLoaded, this.onPageRefreshedCallback);
			}
		}
		onPageChanged() {
			if (!this.pageFilter.match()) {
				this.disconnect();
				return;
			}
			if (this.onPageChangedCallback) this.onPageChangedCallback();
			if (!this.onMutation) return;
			console.log("Observing main element.");
			let observedElement = document.querySelector("div#wrapper");
			if (!observedElement) console.error("Can't attach observer to element.");
			else this.observeElement(observedElement);
			if (this.trackModal) this.observeElement(document.getElementById("dko3_modal"));
		}
		observeElement(element) {
			if (!element) {
				console.error("Can't attach observer to element.");
				return;
			}
			this.observer?.observe(element, {
				attributes: false,
				childList: true,
				subtree: true
			});
		}
		disconnect() {
			this.observer?.disconnect();
		}
	};
	var PartialUrlObserver = class extends BaseObserver {
		constructor(partialUrl, onMutationCallback, trackModal = false, onPageRefreshedCallback) {
			super(void 0, new PartialUrlPageFilter(partialUrl), onMutationCallback, trackModal, onPageRefreshedCallback);
		}
	};
	function checkAndSetDecoration(el, decorator, customCheckAndSet) {
		if (!el) return;
		if (customCheckAndSet) {
			if (!customCheckAndSet(el)) decorator(el);
			return;
		}
		if (el.dataset.gringoDecorated != "true") {
			el.dataset.gringoDecorated = "true";
			decorator(el);
		}
	}
	//#endregion
	//#region node_modules/idb/build/index.js
	const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);
	let idbProxyableTypes;
	let cursorAdvanceMethods;
	function getIdbProxyableTypes() {
		return idbProxyableTypes || (idbProxyableTypes = [
			IDBDatabase,
			IDBObjectStore,
			IDBIndex,
			IDBCursor,
			IDBTransaction
		]);
	}
	function getCursorAdvanceMethods() {
		return cursorAdvanceMethods || (cursorAdvanceMethods = [
			IDBCursor.prototype.advance,
			IDBCursor.prototype.continue,
			IDBCursor.prototype.continuePrimaryKey
		]);
	}
	const transactionDoneMap = /* @__PURE__ */ new WeakMap();
	const transformCache = /* @__PURE__ */ new WeakMap();
	const reverseTransformCache = /* @__PURE__ */ new WeakMap();
	function promisifyRequest(request) {
		const promise = new Promise((resolve, reject) => {
			const unlisten = () => {
				request.removeEventListener("success", success);
				request.removeEventListener("error", error);
			};
			const success = () => {
				resolve(wrap(request.result));
				unlisten();
			};
			const error = () => {
				reject(request.error);
				unlisten();
			};
			request.addEventListener("success", success);
			request.addEventListener("error", error);
		});
		reverseTransformCache.set(promise, request);
		return promise;
	}
	function cacheDonePromiseForTransaction(tx) {
		if (transactionDoneMap.has(tx)) return;
		const done = new Promise((resolve, reject) => {
			const unlisten = () => {
				tx.removeEventListener("complete", complete);
				tx.removeEventListener("error", error);
				tx.removeEventListener("abort", error);
			};
			const complete = () => {
				resolve();
				unlisten();
			};
			const error = () => {
				reject(tx.error || new DOMException("AbortError", "AbortError"));
				unlisten();
			};
			tx.addEventListener("complete", complete);
			tx.addEventListener("error", error);
			tx.addEventListener("abort", error);
		});
		transactionDoneMap.set(tx, done);
	}
	let idbProxyTraps = {
		get(target, prop, receiver) {
			if (target instanceof IDBTransaction) {
				if (prop === "done") return transactionDoneMap.get(target);
				if (prop === "store") return receiver.objectStoreNames[1] ? void 0 : receiver.objectStore(receiver.objectStoreNames[0]);
			}
			return wrap(target[prop]);
		},
		set(target, prop, value) {
			target[prop] = value;
			return true;
		},
		has(target, prop) {
			if (target instanceof IDBTransaction && (prop === "done" || prop === "store")) return true;
			return prop in target;
		}
	};
	function replaceTraps(callback) {
		idbProxyTraps = callback(idbProxyTraps);
	}
	function wrapFunction(func) {
		if (getCursorAdvanceMethods().includes(func)) return function(...args) {
			func.apply(unwrap(this), args);
			return wrap(this.request);
		};
		return function(...args) {
			return wrap(func.apply(unwrap(this), args));
		};
	}
	function transformCachableValue(value) {
		if (typeof value === "function") return wrapFunction(value);
		if (value instanceof IDBTransaction) cacheDonePromiseForTransaction(value);
		if (instanceOfAny(value, getIdbProxyableTypes())) return new Proxy(value, idbProxyTraps);
		return value;
	}
	function wrap(value) {
		if (value instanceof IDBRequest) return promisifyRequest(value);
		if (transformCache.has(value)) return transformCache.get(value);
		const newValue = transformCachableValue(value);
		if (newValue !== value) {
			transformCache.set(value, newValue);
			reverseTransformCache.set(newValue, value);
		}
		return newValue;
	}
	const unwrap = (value) => reverseTransformCache.get(value);
	/**
	* Open a database.
	*
	* @param name Name of the database.
	* @param version Schema version.
	* @param callbacks Additional callbacks.
	*/
	function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
		const request = indexedDB.open(name, version);
		const openPromise = wrap(request);
		if (upgrade) request.addEventListener("upgradeneeded", (event) => {
			upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
		});
		if (blocked) request.addEventListener("blocked", (event) => blocked(event.oldVersion, event.newVersion, event));
		openPromise.then((db) => {
			if (terminated) db.addEventListener("close", () => terminated());
			if (blocking) db.addEventListener("versionchange", (event) => blocking(event.oldVersion, event.newVersion, event));
		}).catch(() => {});
		return openPromise;
	}
	const readMethods = [
		"get",
		"getKey",
		"getAll",
		"getAllKeys",
		"count"
	];
	const writeMethods = [
		"put",
		"add",
		"delete",
		"clear"
	];
	const cachedMethods = /* @__PURE__ */ new Map();
	function getMethod(target, prop) {
		if (!(target instanceof IDBDatabase && !(prop in target) && typeof prop === "string")) return;
		if (cachedMethods.get(prop)) return cachedMethods.get(prop);
		const targetFuncName = prop.replace(/FromIndex$/, "");
		const useIndex = prop !== targetFuncName;
		const isWrite = writeMethods.includes(targetFuncName);
		if (!(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) || !(isWrite || readMethods.includes(targetFuncName))) return;
		const method = async function(storeName, ...args) {
			const tx = this.transaction(storeName, isWrite ? "readwrite" : "readonly");
			let target = tx.store;
			if (useIndex) target = target.index(args.shift());
			return (await Promise.all([target[targetFuncName](...args), isWrite && tx.done]))[0];
		};
		cachedMethods.set(prop, method);
		return method;
	}
	replaceTraps((oldTraps) => ({
		...oldTraps,
		get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
		has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop)
	}));
	const advanceMethodProps = [
		"continue",
		"continuePrimaryKey",
		"advance"
	];
	const methodMap = {};
	const advanceResults = /* @__PURE__ */ new WeakMap();
	const ittrProxiedCursorToOriginalProxy = /* @__PURE__ */ new WeakMap();
	const cursorIteratorTraps = { get(target, prop) {
		if (!advanceMethodProps.includes(prop)) return target[prop];
		let cachedFunc = methodMap[prop];
		if (!cachedFunc) cachedFunc = methodMap[prop] = function(...args) {
			advanceResults.set(this, ittrProxiedCursorToOriginalProxy.get(this)[prop](...args));
		};
		return cachedFunc;
	} };
	async function* iterate(...args) {
		let cursor = this;
		if (!(cursor instanceof IDBCursor)) cursor = await cursor.openCursor(...args);
		if (!cursor) return;
		cursor = cursor;
		const proxiedCursor = new Proxy(cursor, cursorIteratorTraps);
		ittrProxiedCursorToOriginalProxy.set(proxiedCursor, cursor);
		reverseTransformCache.set(proxiedCursor, unwrap(cursor));
		while (cursor) {
			yield proxiedCursor;
			cursor = await (advanceResults.get(proxiedCursor) || cursor.continue());
			advanceResults.delete(proxiedCursor);
		}
	}
	function isIteratorProp(target, prop) {
		return prop === Symbol.asyncIterator && instanceOfAny(target, [
			IDBIndex,
			IDBObjectStore,
			IDBCursor
		]) || prop === "iterate" && instanceOfAny(target, [IDBIndex, IDBObjectStore]);
	}
	replaceTraps((oldTraps) => ({
		...oldTraps,
		get(target, prop, receiver) {
			if (isIteratorProp(target, prop)) return iterate;
			return oldTraps.get(target, prop, receiver);
		},
		has(target, prop) {
			return isIteratorProp(target, prop) || oldTraps.has(target, prop);
		}
	}));
	//#endregion
	//#region typescript/db/gringoDb.ts
	const dbGringo = openDB("gringo", 1, { upgrade(db) {
		db.createObjectStore("PrMetas", { keyPath: "prId" });
	} });
	async function get(key) {
		return (await dbGringo).get("PrMetas", key);
	}
	async function set(val) {
		return (await dbGringo).put("PrMetas", val);
	}
	async function clear() {
		return (await dbGringo).clear("PrMetas");
	}
	async function setAll(prMetas) {
		let tx = (await dbGringo).transaction("PrMetas", "readwrite");
		await Promise.all(prMetas.map((meta) => tx.store.put(meta)));
	}
	async function clearMetasLocal() {
		return clear();
	}
	async function getMetaLocal(prId) {
		return get(prId);
	}
	async function saveMetaLocal(meta) {
		return set(meta);
	}
	async function saveMetasLocal(prMetas) {
		return setAll(prMetas);
	}
	//#endregion
	//#region typescript/sap/api.ts
	async function fetchUserInfoCached() {
		return await (await fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false")).json();
	}
	async function fetchPr(prId) {
		let userInfo = await fetchUserInfoCached();
		return await (await fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/${prId}`)).json();
	}
	async function fetchReqContext() {
		let userInfo = await fetchUserInfoCached();
		return await (await fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/obo`)).json();
	}
	async function fetchShoppingCart() {
		let userInfo = await fetchUserInfoCached();
		return await (await fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/shoppingCart`)).json();
	}
	//#endregion
	//#region typescript/tokenScanner.ts
	var ScannerElse = class {
		scannerIf;
		constructor(scannerIf) {
			this.scannerIf = scannerIf;
		}
		not(callback) {
			if (!this.scannerIf.yes) callback?.(this.scannerIf.scanner);
			return this.scannerIf.scanner;
		}
	};
	var ScannerIf = class {
		yes;
		scanner;
		constructor(yes, scanner) {
			this.yes = yes;
			this.scanner = scanner;
		}
		then(callback) {
			if (this.yes) callback(this.scanner);
			return new ScannerElse(this);
		}
	};
	var TokenScanner = class TokenScanner {
		valid;
		source;
		cursor;
		constructor(text) {
			this.valid = true;
			this.source = text;
			this.cursor = text;
		}
		static create(text) {
			return new TokenScanner(text);
		}
		result() {
			if (this.valid) return this.cursor;
		}
		find(...tokens) {
			return this.#find("", tokens);
		}
		match(...tokens) {
			return this.#find("^\\s*", tokens);
		}
		#find(prefix, tokens) {
			if (!this.valid) return this;
			let rxString = prefix + tokens.map((token) => escapeRegexChars(token) + "\\s*").join("");
			let match = RegExp(rxString).exec(this.cursor);
			if (match) {
				this.cursor = this.cursor.substring(match.index + match[0].length);
				return this;
			}
			this.valid = false;
			return this;
		}
		ifMatch(...tokens) {
			if (!this.valid) return new ScannerIf(true, this);
			this.match(...tokens);
			if (this.valid) return new ScannerIf(true, this);
			else {
				this.valid = true;
				return new ScannerIf(false, this);
			}
		}
		clip(len) {
			if (!this.valid) return this;
			this.cursor = this.cursor.substring(0, len);
			return this;
		}
		clipTo(end) {
			if (!this.valid) return this;
			let found = this.cursor.indexOf(end);
			if (found < 0) {
				this.valid = false;
				return this;
			}
			this.cursor = this.cursor.substring(0, found);
			return this;
		}
		clone() {
			let newScanner = new TokenScanner(this.cursor);
			newScanner.valid = this.valid;
			return newScanner;
		}
		clipString() {
			let isString = false;
			this.ifMatch("'").then((result) => {
				isString = true;
				return result.clipTo("'");
			}).not().ifMatch("\"").then((result) => {
				isString = true;
				return result.clipTo("\"");
			}).not();
			this.valid = this.valid && isString;
			return this;
		}
		captureString(callback) {
			let result = this.clone().clipString().result();
			if (result) {
				callback(result);
				this.ifMatch("'").then((result) => result.find("'")).not().ifMatch("\"").then((result) => result.find("\"")).not();
			}
			return this;
		}
		getString() {
			return this.clipString().result();
		}
	};
	//#endregion
	//#region typescript/fetchChain.ts
	var FetchChain = class {
		lastText = "";
		get() {
			return this.lastText;
		}
		getJson() {
			if (this.lastText === void 0) return null;
			return JSON.parse(this.lastText);
		}
		set(text) {
			this.lastText = text;
		}
		async fetch(url) {
			this.lastText = await fetchText(url ?? this.lastText ?? "--null--");
			return this.lastText;
		}
		async post(url, body) {
			this.lastText = await fetchTextPost(url, body);
			return this.lastText;
		}
		findDocReadyLoadUrl() {
			this.lastText = getDocReadyLoadUrl(this.lastText ?? "--null--");
			return this.lastText;
		}
		findDocReadyLoadScript() {
			this.lastText = getDocReadyLoadScript(this.lastText ?? "--null--")?.result();
			return this.lastText;
		}
		find(...args) {
			this.lastText = new TokenScanner(this.lastText ?? "--null--").find(...args).result();
			return this.lastText;
		}
		getQuotedString() {
			let daString = "";
			this.lastText = new TokenScanner(this.lastText ?? "--null--").captureString(((res) => daString = res)).result();
			return daString;
		}
		clipTo(end) {
			this.lastText = new TokenScanner(this.lastText ?? "--null--").clipTo(end).result();
		}
		div() {
			let el = document.createElement("div");
			el.innerHTML = this.lastText ?? "";
			return el;
		}
		includes(text) {
			return this.lastText?.includes(text) ?? false;
		}
	};
	function findDocReady(scanner) {
		return scanner.find("$", "(", "document", ")", ".", "ready", "(");
	}
	function getDocReadyLoadUrl(text) {
		let scanner = new TokenScanner(text);
		while (true) {
			let docReady = findDocReady(scanner);
			if (!docReady.valid) return void 0;
			let url = docReady.clone().clipTo("<\/script>").find(".", "load", "(").clipString().result();
			if (url) return url;
			scanner = docReady;
		}
	}
	function getDocReadyLoadScript(text) {
		let scanner = new TokenScanner(text);
		while (true) {
			let docReady = findDocReady(scanner);
			if (!docReady.valid) return void 0;
			let script = docReady.clone().clipTo("<\/script>");
			if (script.clone().find(".", "load", "(").valid) return script;
			scanner = docReady;
		}
	}
	async function fetchText(url) {
		return (await fetch(url)).text();
	}
	async function fetchTextPost(url, body) {
		let bodyText;
		let headers;
		if (typeof body == "string") {
			bodyText = body;
			headers = { "Content-Type": "text/plain" };
		} else {
			bodyText = JSON.stringify(body);
			headers = { "Content-Type": "application/json" };
		}
		return (await fetch(url, {
			method: "POST",
			body: bodyText,
			headers
		})).text();
	}
	//#endregion
	//#region typescript/aanvragen/requests.ts
	let globalBtwTarifs = null;
	async function fetchRequestListChunk(chain, userInfo, zSince) {
		if (!zSince) zSince = (/* @__PURE__ */ new Date()).toISOString().replaceAll("T", " ").split(".")[0] + " GMT";
		await chain.post(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo.hashedUser}/requisition/getYourRequestsWithTabSupport?yourRequestsTab=requisition&yourRequestType=all&browserRequestId=newYourRequests1779060906435`, {
			"searchFilters": {
				"LastUpdatedFromDate": "2026-02-17 23:00:00 GMT",
				"LastUpdatedToDate": zSince
			},
			"requestTypeFilter": "all",
			"orderByField": "daterequested",
			"ascendingOrder": false
		});
		return await chain.getJson();
	}
	async function fetchRequestList() {
		let chain = new FetchChain();
		await chain.fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false");
		let userInfo = chain.getJson();
		if (userInfo == null) throw new Error("gringo: could not get userInfo.");
		let requestList = await fetchRequestListChunk(chain, userInfo);
		if (requestList.requestList.length > 0) while (true) {
			let requestList2 = await fetchRequestListChunk(chain, userInfo, requestList.requestList[requestList.requestList.length - 1].lastModifiedDate + " 00:00:00 GMT");
			if (requestList2.requestList.length == 0) break;
			requestList.requestList.push(...requestList2.requestList);
		}
		return requestList;
	}
	async function fetchFullRequest(prId, ctx) {
		let pr = await fetchPr(prId);
		ctx.infoBlock.info.innerHTML = `PR details ophalen...(${ctx.counter++})`;
		if (pr.title == null) return null;
		return pr;
	}
	async function fetchRequestListAndDetails(infoBlock) {
		infoBlock.info.innerHTML = "PR lijst ophalen...";
		let requestList = await fetchRequestList();
		infoBlock.info.innerHTML = "PR details ophalen...";
		let ctx = {
			counter: 0,
			infoBlock
		};
		let promises = requestList.requestList.map((r) => {
			let requestId = r.reqUniqueName;
			return fetchFullRequest(requestId, ctx);
		});
		let detailsList = await Promise.all(promises);
		let jsonList = detailsList.filter((r) => r != null).map((r) => {
			if (r.lineItems == null) return [];
			return r.lineItems.map((item) => {
				let { currency, currencySymbol, ...compactItem } = createCompactReqItem(item);
				return {
					prId: r.reqId,
					status: r.status,
					title: r.title.value,
					lineNumber: item.lineNumber,
					...compactItem
				};
			});
		}).flat();
		await cloud.json.upload(KEY_ALL_PRS_FILENAME_NOEXT + "_2026.json", jsonList);
		return detailsList;
	}
	async function fetchChangedMetas() {
		let changedMetas;
		let zSince = localStorage.getItem(KEY_LAST_FETCHED_METAS);
		if (!zSince) {
			await clearMetasLocal();
			changedMetas = [];
		} else changedMetas = await cloud.json.fetchSince(KEY_CLOUD_METAS_FOLDER, zSince);
		let fetchedDate = /* @__PURE__ */ new Date();
		fetchedDate = /* @__PURE__ */ new Date(fetchedDate.getTime() - 300 * 1e3);
		let zFetchedDate = fetchedDate.toISOString();
		localStorage.setItem(KEY_LAST_FETCHED_METAS, zFetchedDate);
		return changedMetas;
	}
	async function fetchMetaCached(prId) {
		let localMeta = await getMetaLocal(prId);
		if (localMeta) return localMeta;
		let meta = {
			prId,
			tags: []
		};
		try {
			meta = await cloud.json.fetch(KEY_CLOUD_METAS_FOLDER + prId);
		} catch {
			await cloud.json.upload(KEY_CLOUD_METAS_FOLDER + prId, meta);
		}
		await saveMetaLocal(meta);
		return meta;
	}
	async function saveMeta(prId, meta, what) {
		if (what == "localStorage and cloud") await cloud.json.upload(KEY_CLOUD_METAS_FOLDER + prId, meta);
		await saveMetaLocal(meta);
	}
	async function getBtwTarifsCachedInSession() {
		if (globalBtwTarifs) return globalBtwTarifs;
		globalBtwTarifs = /* @__PURE__ */ new Map();
		let tarifs;
		try {
			tarifs = await cloud.json.fetch(BTW_TARIFS_FILENAME);
		} catch {
			tarifs = { tarifs: [] };
		}
		tarifs.tarifs.forEach((t) => globalBtwTarifs.set(t.commodityCode, t));
		return globalBtwTarifs;
	}
	async function uploadBtwTarifs(tarifsMap) {
		let tarifs = { tarifs: [...tarifsMap.values()] };
		await cloud.json.upload(BTW_TARIFS_FILENAME, tarifs);
		globalBtwTarifs = tarifsMap;
	}
	async function getBtwTarif(commodityCode) {
		return (await getBtwTarifsCachedInSession()).get(commodityCode) ?? null;
	}
	function getAccountingField(prItem, idIncludes) {
		let field = prItem.accounting.fields?.find((f) => f.id.endsWith(idIncludes));
		if (!field) return null;
		let code = field.uniqueName;
		let dscr = field.value;
		if (!code) return null;
		return {
			code,
			dscr
		};
	}
	function getAdvancedField(prItem, idIncludes) {
		let field = prItem.advanced.fields?.find((f) => f.id.endsWith(idIncludes));
		if (!field) return null;
		let code = field.uniqueName;
		let dscr = field.value;
		if (!code) return null;
		return {
			code,
			dscr
		};
	}
	function getPrItemCommodity(prItem) {
		return getAdvancedField(prItem, "pAtHCommonCommodityCode");
	}
	function getPrItemLedger(prItem) {
		return getAccountingField(prItem, "pAtHGeneralLedger");
	}
	function getPrItemAsset(prItem) {
		return getAccountingField(prItem, "pAtHAsset");
	}
	function getPrItemGrant(prItem) {
		return getAccountingField(prItem, "cus_Grant");
	}
	let globalTagsMap = null;
	async function getGlobalTags() {
		let globalSettings = await getGlobalSettingsCached();
		if (!globalTagsMap) globalTagsMap = new Map(globalSettings.tagDefs.map((t) => [t.name, t]));
		return globalTagsMap;
	}
	//#endregion
	//#region typescript/aanvragen/budgetCodes.ts
	let ledgerToBudgetCodes = [
		{
			ledger10: "2110000000",
			budget: "21100000"
		},
		{
			ledger10: "2231000000",
			budget: "22310000"
		},
		{
			ledger10: "2300000000",
			budget: "23000000"
		},
		{
			ledger10: "2301000000",
			budget: "23010000"
		},
		{
			ledger10: "2302000000",
			budget: "23020000"
		},
		{
			ledger10: "2400000000",
			budget: "24000000"
		},
		{
			ledger10: "2402000000",
			budget: "24020000"
		},
		{
			ledger10: "2406000000",
			budget: "24060000"
		},
		{
			ledger10: "2410000000",
			budget: "24100000"
		},
		{
			ledger10: "2420000000",
			budget: "24200000"
		},
		{
			ledger10: "2510000000",
			budget: "25100000"
		},
		{
			ledger10: "6030000100",
			budget: "60310100"
		},
		{
			ledger10: "6030000150",
			budget: "60310150"
		},
		{
			ledger10: "6030000200",
			budget: "60320000"
		},
		{
			ledger10: "6030000300",
			budget: "60330000"
		},
		{
			ledger10: "6100000100",
			budget: "61000000"
		},
		{
			ledger10: "6103000300",
			budget: "61030000"
		},
		{
			ledger10: "6103000400",
			budget: "61030004"
		},
		{
			ledger10: "6103000500",
			budget: "61030005"
		},
		{
			ledger10: "6103000600",
			budget: "61030006"
		},
		{
			ledger10: "6103000700",
			budget: "61030007"
		},
		{
			ledger10: "6103000900",
			budget: "61030000"
		},
		{
			ledger10: "6103001000",
			budget: "61030009"
		},
		{
			ledger10: "6112000000",
			budget: "61120000"
		},
		{
			ledger10: "6120000100",
			budget: "61200000"
		},
		{
			ledger10: "6120000200",
			budget: "61200000"
		},
		{
			ledger10: "6120000300",
			budget: "61200000"
		},
		{
			ledger10: "6120000400",
			budget: "61200000"
		},
		{
			ledger10: "6120009000",
			budget: "61200000"
		},
		{
			ledger10: "6130000100",
			budget: "61310000"
		},
		{
			ledger10: "6130000200",
			budget: "61310000"
		},
		{
			ledger10: "6130000300",
			budget: "61310000"
		},
		{
			ledger10: "6130000400",
			budget: "61310000"
		},
		{
			ledger10: "6130000500",
			budget: "61310000"
		},
		{
			ledger10: "6130000600",
			budget: "61310000"
		},
		{
			ledger10: "6130000800",
			budget: "61310000"
		},
		{
			ledger10: "6130000900",
			budget: "61310000"
		},
		{
			ledger10: "6130001000",
			budget: "61300000"
		},
		{
			ledger10: "6130001200",
			budget: "61310000"
		},
		{
			ledger10: "6130001300",
			budget: "61310000"
		},
		{
			ledger10: "6130001400",
			budget: "61314000"
		},
		{
			ledger10: "6130001500",
			budget: "61310000"
		},
		{
			ledger10: "6130009000",
			budget: "61310000"
		},
		{
			ledger10: "6131000100",
			budget: "61310000"
		},
		{
			ledger10: "6131000200",
			budget: "61310000"
		},
		{
			ledger10: "6131000300",
			budget: "61310000"
		},
		{
			ledger10: "6131000400",
			budget: "61310000"
		},
		{
			ledger10: "6131000500",
			budget: "61310000"
		},
		{
			ledger10: "6131000600",
			budget: "61310000"
		},
		{
			ledger10: "6141000100",
			budget: "61410000"
		},
		{
			ledger10: "6141100100",
			budget: "61411000"
		},
		{
			ledger10: "6141100300",
			budget: "61410000"
		},
		{
			ledger10: "6141100400",
			budget: "61410000"
		},
		{
			ledger10: "6142000100",
			budget: "61420100"
		},
		{
			ledger10: "6142000200",
			budget: "61420200"
		},
		{
			ledger10: "6142100200",
			budget: "61420002"
		},
		{
			ledger10: "6142100300",
			budget: "61420003"
		},
		{
			ledger10: "6142100400",
			budget: "61420004"
		},
		{
			ledger10: "6144000200",
			budget: "61410000"
		},
		{
			ledger10: "6144000400",
			budget: "61410000"
		},
		{
			ledger10: "6145000100",
			budget: "61450000"
		},
		{
			ledger10: "6145000200",
			budget: "61450000"
		},
		{
			ledger10: "6146000100",
			budget: "61460000"
		},
		{
			ledger10: "6146000200",
			budget: "61460000"
		},
		{
			ledger10: "6146000300",
			budget: "61460000"
		},
		{
			ledger10: "6146000400",
			budget: "61460000"
		},
		{
			ledger10: "6146000500",
			budget: "61460000"
		},
		{
			ledger10: "6146000700",
			budget: "61460000"
		},
		{
			ledger10: "6146000800",
			budget: "61460000"
		},
		{
			ledger10: "6146000900",
			budget: "61490000"
		},
		{
			ledger10: "6146001100",
			budget: "61460000"
		},
		{
			ledger10: "6147000100",
			budget: "61410000"
		},
		{
			ledger10: "6148000000",
			budget: "61480000"
		},
		{
			ledger10: "6151000400",
			budget: "61510000"
		},
		{
			ledger10: "6152000100",
			budget: "61520001"
		},
		{
			ledger10: "6152000200",
			budget: "61520002"
		},
		{
			ledger10: "6152000300",
			budget: "61530000"
		},
		{
			ledger10: "6152000400",
			budget: "61530000"
		},
		{
			ledger10: "6152000600",
			budget: "61560000"
		},
		{
			ledger10: "6152000800",
			budget: "61580000"
		},
		{
			ledger10: "6152000900",
			budget: "61529000"
		},
		{
			ledger10: "6152001200",
			budget: "61560000"
		},
		{
			ledger10: "6152001300",
			budget: "61560000"
		},
		{
			ledger10: "6152009000",
			budget: "61530000"
		},
		{
			ledger10: "6152100100",
			budget: "61520001"
		},
		{
			ledger10: "6161000100",
			budget: "61611000"
		},
		{
			ledger10: "6161000200",
			budget: "61612000"
		},
		{
			ledger10: "6161000300",
			budget: "61613000"
		},
		{
			ledger10: "6170000000",
			budget: "61700000"
		},
		{
			ledger10: "6170000100",
			budget: "61700000"
		},
		{
			ledger10: "6180000000",
			budget: "61800000"
		},
		{
			ledger10: "6201000000",
			budget: "62010000"
		},
		{
			ledger10: "6201000100",
			budget: "62010000"
		},
		{
			ledger10: "6201000200",
			budget: "62010000"
		},
		{
			ledger10: "6201000300",
			budget: "62010000"
		},
		{
			ledger10: "6201000500",
			budget: "62010000"
		},
		{
			ledger10: "6201000700",
			budget: "62010000"
		},
		{
			ledger10: "6202100000",
			budget: "62020000"
		},
		{
			ledger10: "6202100100",
			budget: "62020000"
		},
		{
			ledger10: "6202100200",
			budget: "62020000"
		},
		{
			ledger10: "6202100300",
			budget: "62020000"
		},
		{
			ledger10: "6202100500",
			budget: "62020000"
		},
		{
			ledger10: "6202100700",
			budget: "62020000"
		},
		{
			ledger10: "6202200000",
			budget: "62020000"
		},
		{
			ledger10: "6202200100",
			budget: "62020000"
		},
		{
			ledger10: "6202200200",
			budget: "62020000"
		},
		{
			ledger10: "6202200300",
			budget: "62020000"
		},
		{
			ledger10: "6207000000",
			budget: "62070000"
		},
		{
			ledger10: "6208000000",
			budget: "62080300"
		},
		{
			ledger10: "6211000000",
			budget: "62110000"
		},
		{
			ledger10: "6211000100",
			budget: "62110000"
		},
		{
			ledger10: "6211000200",
			budget: "62110000"
		},
		{
			ledger10: "6212100000",
			budget: "62120000"
		},
		{
			ledger10: "6212200000",
			budget: "62120000"
		},
		{
			ledger10: "6218000000",
			budget: "62180300"
		},
		{
			ledger10: "6219000000",
			budget: "62190000"
		},
		{
			ledger10: "6221000000",
			budget: "62210000"
		},
		{
			ledger10: "6222000000",
			budget: "62220000"
		},
		{
			ledger10: "6223000000",
			budget: "62230000"
		},
		{
			ledger10: "6230000000",
			budget: "62300000"
		},
		{
			ledger10: "6230000100",
			budget: "62300000"
		},
		{
			ledger10: "6230000300",
			budget: "62300000"
		},
		{
			ledger10: "6230000400",
			budget: "62300000"
		},
		{
			ledger10: "6230000600",
			budget: "62300000"
		},
		{
			ledger10: "6230000700",
			budget: "62300000"
		},
		{
			ledger10: "6230001000",
			budget: "62300000"
		},
		{
			ledger10: "6230001100",
			budget: "62300000"
		},
		{
			ledger10: "6230001200",
			budget: "62300000"
		},
		{
			ledger10: "6230001300",
			budget: "62300000"
		},
		{
			ledger10: "6241000000",
			budget: "62410000"
		},
		{
			ledger10: "6241000100",
			budget: "62410000"
		},
		{
			ledger10: "6400000100",
			budget: "64000000"
		},
		{
			ledger10: "6400000300",
			budget: "64000000"
		},
		{
			ledger10: "6400000400",
			budget: "64000000"
		},
		{
			ledger10: "6400000500",
			budget: "64000000"
		},
		{
			ledger10: "6400000600",
			budget: "64000000"
		},
		{
			ledger10: "6400009000",
			budget: "64000000"
		},
		{
			ledger10: "6420000000",
			budget: "64200000"
		},
		{
			ledger10: "6430000200",
			budget: "64300000"
		},
		{
			ledger10: "6430000400",
			budget: "64300000"
		},
		{
			ledger10: "6430000600",
			budget: "64300000"
		},
		{
			ledger10: "6430000700",
			budget: "64300000"
		},
		{
			ledger10: "6430000800",
			budget: "64300000"
		},
		{
			ledger10: "6430009000",
			budget: "64300000"
		},
		{
			ledger10: "6440000100",
			budget: "64410001"
		},
		{
			ledger10: "6440000200",
			budget: "64420000"
		},
		{
			ledger10: "6440000300",
			budget: "64410003"
		},
		{
			ledger10: "6440000400",
			budget: "64440000"
		},
		{
			ledger10: "6490000000",
			budget: "64900000"
		},
		{
			ledger10: "6500000000",
			budget: "65000000"
		},
		{
			ledger10: "6500001200",
			budget: "65000000"
		},
		{
			ledger10: "6500001500",
			budget: "65000330"
		},
		{
			ledger10: "6540000000",
			budget: "65400000"
		},
		{
			ledger10: "6570000000",
			budget: "65700000"
		},
		{
			ledger10: "6570000200",
			budget: "65700000"
		},
		{
			ledger10: "6570000400",
			budget: "65700000"
		},
		{
			ledger10: "6570009000",
			budget: "65700000"
		}
	];
	let budgetDscrs = [
		["60320000", "Niet-maximumfactuur"],
		["60320000", "Aankopen lln niet maximumfactuur voor doorverkoop"],
		["60330000", "Doorverkoop: voeding en drank"],
		["61000000", "Huur onroerende goederen"],
		["61030000", "Onderhoud en herstel van onroerende goederen"],
		["61200000", "Verzekeringen"],
		["61300000", "Auteursrechten, bijdragen en lidgelden"],
		["61310000", "Erelonen zonder inhouding BV"],
		["61314000", "Wijkwerkcheques"],
		["61410000", "Kosten ivm roerende goederen"],
		["61411000", "Gereedschappen en materialen"],
		["61450000", "Schoonmaak en WC-papier, handdoeken"],
		["61460000", "Communicatiekosten"],
		["61490000", "Klein kantoormateriaal"],
		["61510000", "Evenementen"],
		["61520001", "WS Vlaanderen Nascholingsgelden"],
		["61530000", "Personeel- en leerlingenkosten allerlei"],
		["61560000", "Veiligheid personeel en leerlingen"],
		["61580000", "Dienstverplaatsingen"],
		["61611000", "Kosten uitstappen niet doorgerekend"],
		["61612000", "Didactische kosten"],
		["61613000", "Projecten"],
		["64300000", "Andere werkingskosten"],
		["65700000", "Andere financiële kosten"],
		["23020000", "Uitrusting en inrichting"],
		["24020000", "Computers en ICT"],
		["24000000", "Meubilair"],
		["24200000", "Muziekinstrumenten"]
	];
	//#endregion
	//#region typescript/aanvragen/aggregate.ts
	let _budgetMap = null;
	function getBudgetCode(ledger) {
		if (!_budgetMap) {
			_budgetMap = /* @__PURE__ */ new Map();
			ledgerToBudgetCodes.forEach((budget) => {
				_budgetMap.set(budget.ledger10, budget);
			});
		}
		return _budgetMap.get(ledger.substring(0, 10)) ?? null;
	}
	let _budgetDscrMap = null;
	function getBudgetDscr(budget) {
		if (!_budgetDscrMap) {
			_budgetDscrMap = /* @__PURE__ */ new Map();
			budgetDscrs.forEach((budget) => {
				_budgetDscrMap.set(budget[0], budget[1]);
			});
		}
		return _budgetDscrMap.get(budget) ?? null;
	}
	async function getExtendedRequests(infoBlock) {
		let reqs = (await fetchRequestListAndDetails(infoBlock)).filter((pr) => pr != null).filter((pr) => pr.status != "sdfsdf");
		let extendedReqs = [];
		for (const pr of reqs) extendedReqs.push(await createExpandedPr(pr));
		return extendedReqs;
	}
	async function getItemsPerGroup(items, groupFunc, groups) {
		let groupMap = /* @__PURE__ */ new Map();
		for (let group of groups) groupMap.set(group, []);
		for (let item of items) {
			let group = await groupFunc(item);
			if (!groupMap.has(group)) groupMap.set(group, []);
			groupMap.get(group).push(item);
		}
		return groupMap;
	}
	async function exportPrItemsToExcel(infoBlock) {
		let jsonPrData = await createJsonPrData(infoBlock);
		let headers = [
			"prId",
			"status",
			"itemNo",
			"bruto",
			"tarif",
			"project",
			"tags",
			"title",
			"budget"
		];
		let rows = [];
		for (let item of jsonPrData.items) {
			let meta = await fetchMetaCached(item.prId);
			let row = [];
			row.push(item.prId);
			row.push(item.status);
			row.push(item.itemNo);
			row.push(item.bruto.toString());
			row.push(item.tarif);
			row.push(meta.project ?? "");
			row.push(meta.tags.join(","));
			row.push(item.title);
			row.push(item.budget);
			rows.push(row);
		}
		let table = createHtmlTable(headers, rows);
		sessionStorage.setItem("PrItemTable", table.outerHTML);
		await navigator.clipboard.writeText(table.outerHTML);
		console.log("CIOPIED.");
	}
	async function createJsonPrData(infoBlock) {
		let prs = await getExtendedRequests(infoBlock);
		let jsonPrData = { items: [] };
		for (let pr of prs) for (const item of pr.items) {
			const index = pr.items.indexOf(item);
			let prId = pr.pr.reqId;
			let status = pr.pr.status;
			let itemNo = index.toString();
			let bruto = 0;
			if (item.tarif) bruto = calcBrutoLinePrice(createCompactReqItem(item.item), item.tarif.tarif);
			else bruto = calcBrutoLinePrice(createCompactReqItem(item.item), 0);
			let tarif = item.tarif?.tarif ? item.tarif?.tarif.toString() : "";
			let meta = await fetchMetaCached(pr.pr.reqId);
			meta.project;
			meta.tags.join(",");
			let title = pr.pr.title.value;
			let budget = item.budget?.budget ?? "";
			let grant = item.grant?.code ?? "";
			jsonPrData.items.push({
				prId,
				status,
				itemNo,
				bruto,
				tarif,
				title,
				budget,
				grant
			});
		}
		return jsonPrData;
	}
	async function getExpenses(infoBlock) {
		let jsonPrData;
		let jsonPrDataStr = sessionStorage.getItem("jsonPrData");
		if (jsonPrDataStr) jsonPrData = JSON.parse(jsonPrDataStr);
		else {
			jsonPrData = await createJsonPrData(infoBlock);
			sessionStorage.setItem("jsonPrData", JSON.stringify(jsonPrData));
		}
		return jsonPrData.items.filter((item) => !["In aanmaak", "Afgewezen"].includes(item.status)).filter((item) => {
			return item.budget != "" && (item.budget.startsWith("6") || item.budget.startsWith("2"));
		});
	}
	//#endregion
	//#region typescript/sap/SapUserInfo.ts
	async function getUserInfo() {
		return fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false").then((res) => res.json());
	}
	//#endregion
	//#region typescript/calculator/cursor.ts
	var Cursor = class Cursor {
		text;
		currentPos;
		length;
		constructor(text) {
			this.text = text;
			this.length = this.text.length;
			this.currentPos = -1;
		}
		static copy(cursor) {
			let newCursor = new Cursor(cursor.text);
			newCursor.currentPos = cursor.currentPos;
			return newCursor;
		}
		eat(char) {
			if (this.currentPos >= this.length) return false;
			if (this.text[this.currentPos] == char) {
				this.currentPos++;
				return true;
			}
			return false;
		}
		get pos() {
			return this.currentPos;
		}
		get current() {
			if (this.currentPos >= this.length) return "";
			return this.text[this.currentPos];
		}
		next() {
			if (this.currentPos >= this.length) return "";
			this.currentPos++;
			return this.current;
		}
		peek() {
			if (this.currentPos + 1 >= this.length) return "";
			return this.text[this.currentPos + 1];
		}
		getText(pos, length) {
			return this.text.substring(pos, pos + length);
		}
		back() {
			if (this.currentPos < 0) return;
			this.currentPos--;
		}
	};
	//#endregion
	//#region typescript/calculator/tokenizer.ts
	function getText(token) {
		return token.cursor.getText(token.pos, token.length);
	}
	var Tokenizer = class {
		cursor;
		constructor(text) {
			this.cursor = new Cursor(text);
		}
		setCursor(cursor) {
			this.cursor = cursor;
		}
		cloneCursor() {
			return Cursor.copy(this.cursor);
		}
		next() {
			this.skipWhitespace();
			let char = this.cursor.next();
			switch (char) {
				case "": return null;
				case "€":
				case "$":
				case "(":
				case ")":
				case "+":
				case "-":
				case "*":
				case "/": return {
					type: char,
					cursor: this.cursor,
					pos: this.cursor.pos,
					length: 1
				};
				case ".":
				case ",":
				case "0":
				case "1":
				case "2":
				case "3":
				case "4":
				case "5":
				case "6":
				case "7":
				case "8":
				case "9": return this.getNumberToken();
				default: return {
					type: "UNKNOWN",
					cursor: this.cursor,
					pos: this.cursor.pos,
					length: 1
				};
			}
		}
		getNumberToken() {
			let token = {
				type: "NUMBER",
				cursor: this.cursor,
				pos: this.cursor.pos,
				length: 0
			};
			let start = this.cursor.pos;
			while (this.cursor.peek().match(/[\d., ]/)) this.cursor.next();
			while (this.cursor.current == " ") this.cursor.back();
			token.length = this.cursor.pos - start + 1;
			return token;
		}
		skipWhitespace() {
			while (this.cursor.peek().match(/\s/)) this.cursor.next();
		}
	};
	//#endregion
	//#region typescript/calculator/peekingTokenizer.ts
	var PeekingTokenizer = class {
		tokenizer;
		peekedToken = null;
		constructor(text) {
			this.tokenizer = new Tokenizer(text);
		}
		peek() {
			if (this.peekedToken) return this.peekedToken;
			let cursor = this.tokenizer.cloneCursor();
			this.peekedToken = this.tokenizer.next();
			this.tokenizer.setCursor(cursor);
			return this.peekedToken;
		}
		next() {
			this.peekedToken = null;
			return this.tokenizer.next();
		}
		getCursor() {
			return this.tokenizer.cloneCursor();
		}
		match(tokenType) {
			let token = this.peek();
			if (token?.type == tokenType) {
				this.next();
				return token;
			}
			return null;
		}
	};
	//#endregion
	//#region typescript/calculator/parser.ts
	const ERR_EXPECTED_CLOSE_PAREN = {
		error_type: "E",
		message: "expected ')'"
	};
	var Parser = class {
		peekingTokenizer;
		constructor(text) {
			this.peekingTokenizer = new PeekingTokenizer(text);
		}
		parse() {
			return this.parseExpression();
		}
		parseExpression() {
			let term1 = this.parseTerm();
			while (true) {
				let operator = this.peekingTokenizer.peek();
				if (!operator) return term1;
				if (operator.type != "+" && operator.type != "-") return term1;
				this.peekingTokenizer.next();
				let term2 = this.parseTerm();
				if (operator.type == "+") term1 = {
					result: term1.result + term2.result,
					errors: term1.errors.concat(term2.errors)
				};
				else term1 = {
					result: term1.result - term2.result,
					errors: term1.errors.concat(term2.errors)
				};
			}
		}
		parseTerm() {
			let factor1 = this.parseFactor();
			while (true) {
				let operator = this.peekingTokenizer.peek();
				if (!operator) return factor1;
				if (operator.type != "*" && operator.type != "/") return factor1;
				this.peekingTokenizer.next();
				let factor2 = this.parseFactor();
				if (operator.type == "*") factor1 = {
					result: factor1.result * factor2.result,
					errors: factor1.errors.concat(factor2.errors)
				};
				else factor1 = {
					result: factor1.result / factor2.result,
					errors: factor1.errors.concat(factor2.errors)
				};
			}
		}
		parseFactor() {
			if (this.peekingTokenizer.match("(")) {
				let res = this.parseExpression();
				let peeked = this.peekingTokenizer.peek();
				if (peeked?.type == ")") this.peekingTokenizer.next();
				else if (peeked != null) res.errors.push(ERR_EXPECTED_CLOSE_PAREN);
				else res.errors.push(ERR_EXPECTED_CLOSE_PAREN);
				return res;
			}
			return this.parseCurrency();
		}
		parseCurrency() {
			let peeked = this.peekingTokenizer.peek();
			if (!peeked) return {
				result: 0,
				errors: []
			};
			if (peeked.type == "€") this.peekingTokenizer.next();
			return this.parseNumber();
		}
		parseNumber() {
			let token = this.peekingTokenizer.next();
			if (!token) return {
				result: 0,
				errors: []
			};
			let text = getText(token);
			text = text.replaceAll(" ", "");
			if (text.startsWith("€")) text = text.substring(1);
			let decimalPoint;
			let thousandSeparator;
			let lastCommaIndex = text.lastIndexOf(",");
			if (text.lastIndexOf(".") > lastCommaIndex) {
				decimalPoint = ".";
				thousandSeparator = ",";
			} else {
				decimalPoint = ",";
				thousandSeparator = ".";
			}
			text = text.replaceAll(thousandSeparator, "");
			let slices = text.split(decimalPoint);
			if (slices.length > 1) {
				let decimals = slices.pop();
				text = slices.join("") + "." + decimals;
			}
			return {
				result: parseFloat(text),
				errors: []
			};
		}
	};
	//#endregion
	//#region typescript/calcField.ts
	var CalcField = class {
		input;
		resultDiv;
		resultLabel;
		resultErrorImage;
		result = null;
		postFieldLabelDiv = null;
		constructor(container, label, postFieldLabel, postFieldLabelClass, onRecalculated) {
			let postFieldEmmet = "";
			let postFieldLabelClassString = postFieldLabelClass.join(".");
			if (postFieldLabelClassString) postFieldLabelClassString = "." + postFieldLabelClassString;
			if (postFieldLabel != "") postFieldEmmet = `+
                div.postFieldLabel>
                    div${postFieldLabelClassString}{${postFieldLabel}}
            `;
			let fieldDiv = emmet.appendChild(container, `
            div>
                div.input-wrap>
                    div.form-group>(
                        label.editable-field-label{${label}}+
                        div.field-wrapper>(
                                (
                                div.flexRow>(
                                    input.form-control[type="text"]
                                    ${postFieldEmmet}
                                )
                            )+
                            div.flexRow.calcResult>(
                                label+
                                i.fa.fa-triangle-exclamation
                            )
                        )                                                    
                    )
        `).first;
			this.input = fieldDiv.querySelector("input");
			this.resultDiv = fieldDiv.querySelector("div.calcResult");
			this.resultLabel = this.resultDiv.querySelector("label");
			this.resultErrorImage = fieldDiv.querySelector("i.fa");
			this.input.addEventListener("keyup", (ev) => {
				this.reCalc();
				onRecalculated(this);
			});
			if (postFieldLabel != "") this.postFieldLabelDiv = fieldDiv.querySelector("div.postFieldLabel");
		}
		reCalc() {
			if (this.input.value == "") {
				this.result = null;
				this.resultLabel.textContent = "";
				this.resultDiv.classList.toggle("error", false);
				return;
			}
			this.result = new Parser(this.input.value).parse();
			this.resultLabel.textContent = formatPrice(this.result.result);
			this.resultDiv.classList.toggle("error", this.result.errors.length > 0);
			this.resultErrorImage.title = this.result.errors.map((e) => e.message).join("\n");
		}
	};
	//#endregion
	//#region typescript/entangledFields.ts
	var EntangledFields = class {
		fields;
		currentSourceField;
		isTransfering;
		context;
		constructor(context) {
			this.fields = [];
			this.context = context;
			this.currentSourceField = null;
			this.isTransfering = false;
		}
		add(field, updateCallback1) {
			this.fields.push({
				field,
				callback: updateCallback1
			});
			field.addEventListener("focus", () => {
				if (!this.isTransfering) this.currentSourceField = field;
			});
		}
		setCurrentSource(field) {
			this.currentSourceField = field;
		}
		updateOtherFields() {
			if (this.isTransfering) return;
			this.isTransfering = true;
			this.fields.filter((f) => f.field != this.currentSourceField).forEach((f) => f.callback(this.context));
			this.isTransfering = false;
		}
	};
	//#endregion
	//#region typescript/reqForm/observer.ts
	var ReqFormObserver = class extends PartialUrlObserver {
		constructor() {
			super("reqform", onMutation$2, false, onPageRefreshed$2);
		}
		isPageReallyLoaded() {
			return isPageProbablyLoaded$2();
		}
	};
	var observer_default$1 = new ReqFormObserver();
	function onPageRefreshed$2() {
		gringo("Reqform page refreshed!");
		checkDecorations$1();
	}
	function isPageProbablyLoaded$2() {
		return true;
	}
	function onMutation$2(mutation) {
		checkDecorations$1();
		return false;
	}
	function checkDecorations$1() {
		checkAndSetDecoration(document.querySelector("div.req-form-panel"), decoratePanel);
	}
	function scanAndSelectPerEenheid(ulUnitOfMeasure) {
		let anchorPerEenheid = [...ulUnitOfMeasure.querySelectorAll("a")].find((a) => a.innerText.includes("Per eenheid"));
		if (anchorPerEenheid) {
			anchorPerEenheid.dispatchEvent(new Event("mousedown", { bubbles: true }));
			anchorPerEenheid.dispatchEvent(new Event("click", { bubbles: true }));
			anchorPerEenheid.dispatchEvent(new Event("mouseup", { bubbles: true }));
			ulUnitOfMeasure.style.display = "";
			document.body.dataset.gringoEenheidSet = "true";
			return;
		}
		setTimeout(() => scanAndSelectPerEenheid(ulUnitOfMeasure), 100);
	}
	function scanAndSetRadionButtons(el) {
		let radioButtons = el.querySelectorAll(`af-radio-button-group input[type="radio"]`);
		if (radioButtons.length == 3) {
			radioButtons[0].dispatchEvent(new Event("mousedown", { bubbles: true }));
			radioButtons[0].dispatchEvent(new Event("click", { bubbles: true }));
			radioButtons[0].dispatchEvent(new Event("change", { bubbles: true }));
			radioButtons[0].dispatchEvent(new Event("mouseup", { bubbles: true }));
			radioButtons[2].dispatchEvent(new Event("mousedown", { bubbles: true }));
			radioButtons[2].dispatchEvent(new Event("click", { bubbles: true }));
			radioButtons[2].dispatchEvent(new Event("change", { bubbles: true }));
			radioButtons[2].dispatchEvent(new Event("mouseup", { bubbles: true }));
			document.body.dataset.gringoRadioButtonsSet = "true";
			return;
		}
		setTimeout(() => scanAndSetRadionButtons(el), 100);
	}
	function scanAndSetFirstFieldFocus(el, btnUnitOfMeasure) {
		if (document.body.dataset.gringoEenheidSet == "true" && document.body.dataset.gringoRadioButtonsSet == "true") {
			if (btnUnitOfMeasure.textContent.includes("Per eenheid")) {
				let fieldProductNameInput = el.querySelector("div.adhoc-form-name input");
				setTimeout(() => {
					fieldProductNameInput.focus();
					gringo("focus set.");
				}, 100);
				return;
			}
		}
		gringo("waiting to set focus...");
		setTimeout(() => scanAndSetFirstFieldFocus(el, btnUnitOfMeasure), 100);
	}
	var PriceData = class {
		get btw() {
			return this._btw;
		}
		set btw(value) {
			this._btw = value;
		}
		get netto() {
			return this._netto;
		}
		set netto(value) {
			this._netto = value;
			if (this.expandedPrItem) this.expandedPrItem.item.quantity = this._netto;
			if (this._netto) this._bruto = this._netto * (1 + this._btw / 100);
		}
		get bruto() {
			return this._bruto;
		}
		set bruto(value) {
			this._bruto = value;
			if (this._bruto) this._netto = this._bruto / (1 + this._btw / 100);
			if (this.expandedPrItem) this.expandedPrItem.item.quantity = this._netto;
		}
		_bruto = null;
		_netto = null;
		_btw;
		expandedPrItem;
		constructor(btw, expandedPrItem) {
			this._btw = btw;
			this.expandedPrItem = expandedPrItem;
		}
	};
	function addNettoAndBrutoFields(btw, calcFieldsContainer, expandedPrItem) {
		let entangledFields = new EntangledFields(new PriceData(btw, expandedPrItem));
		calcFieldsContainer.classList.add("flexRow");
		let nettoCalcField = new CalcField(calcFieldsContainer, "Netto", btw.toString() + "%", ["gringo", "blueBlock"], (field) => {
			if (!field.result) return;
			entangledFields.context.netto = field.result.result;
			entangledFields.updateOtherFields();
		});
		let brutoCalcField = new CalcField(calcFieldsContainer, "Bruto", "", [], (field) => {
			if (!field.result) return;
			entangledFields.context.bruto = field.result.result;
			entangledFields.updateOtherFields();
		});
		entangledFields.add(brutoCalcField.input, (ctx) => {
			if (!ctx.bruto) return;
			brutoCalcField.input.value = formatPrice(ctx.bruto, "", "").trim();
			brutoCalcField.reCalc();
		});
		entangledFields.add(nettoCalcField.input, (ctx) => {
			if (!ctx.netto) return;
			nettoCalcField.input.value = formatPrice(ctx.netto, "", "").trim();
			nettoCalcField.reCalc();
		});
		return {
			entangledFields,
			brutoCalcField,
			nettoCalcField
		};
	}
	async function decoratePanel(el) {
		let ul = el.querySelector("div.adhoc-item-detail-section div.input-wrap-container");
		let calcFieldsContainer = emmet.appendChild(ul, `
        div.adhoc-form-input-section.gringo.blueBlock.calcFieldContainer
    `).first;
		let fieldQuantity = el.querySelector("div.field-quantity");
		let tarif = await getBtwTarif((await fetchReqFormInfo()).commodityCode);
		let fieldQuantityInputGroup = fieldQuantity.querySelector(":scope > div.input-group");
		emmet.appendChild(fieldQuantityInputGroup, `
        span.percentSpan>div.gringo.blueBlock{${tarif?.tarif}%}
    `);
		let fieldUnitOfMeasure = el.querySelector(`field[ng-model="unitOfMeasureObject2"]`);
		let btnUnitOfMeasure = fieldUnitOfMeasure.querySelector(`button[ng-class="{'field-button': showEmbargoedField}"]`);
		let ulUnitOfMeasure = fieldUnitOfMeasure.querySelector("ul");
		ulUnitOfMeasure.style.display = "none";
		btnUnitOfMeasure.dispatchEvent(new Event("click"));
		scanAndSelectPerEenheid(ulUnitOfMeasure);
		scanAndSetRadionButtons(el);
		let calcFields = addNettoAndBrutoFields(tarif?.tarif ?? 0, calcFieldsContainer, null);
		let fieldQuantityInput = fieldQuantity.querySelector("input");
		fieldQuantityInput.value = "1";
		calcFields.entangledFields.add(fieldQuantityInput, (ctx) => {
			if (!ctx.netto) return;
			fieldQuantityInput.value = formatPrice(ctx.netto, "", "").trim();
			triggerFieldChanged(fieldQuantityInput);
		});
		decorateFieldQuantity(fieldQuantity);
		let fieldMoney = el.querySelector("div.field-money input");
		fieldMoney.value = "1";
		triggerFieldChanged(fieldMoney);
		scanAndSetFirstFieldFocus(el, btnUnitOfMeasure);
	}
	function decorateFieldQuantity(fieldQuantity) {
		fieldQuantity.classList.add("hidePlusMinButtons");
		let input = fieldQuantity.querySelector("input");
		input.addEventListener("paste", (ev) => {
			let data = ev.clipboardData?.getData("text/plain");
			if (data) {
				input.value = formatPrice(new Parser(data).parse().result, "", "");
				triggerFieldChanged(input);
				ev.preventDefault();
			}
		});
	}
	async function fetchReqFormInfo() {
		let userInfo = await getUserInfo();
		let userId = userInfo.hashedUser;
		let tenant = userInfo.tenant;
		let resourceId = new URLSearchParams(location.search).get("fromresourceid");
		let daUrl = `https://s1-eu.ariba.com/gb/tenant/${tenant}/user/${userId}/resource/formwithresourceoverride/${location.pathname.split("/").pop()}?resourceId=${resourceId}`;
		return await (await fetch(daUrl)).json();
	}
	function triggerFieldChanged(input) {
		input.dispatchEvent(new Event("change"));
		input.dispatchEvent(new Event("input"));
		input.dispatchEvent(new Event("blur"));
		input.dispatchEvent(new Event("keyup"));
		input.dispatchEvent(new Event("mouseout"));
	}
	//#endregion
	//#region typescript/aanvraag/observer.ts
	var RequisitionObserver = class extends PartialUrlObserver {
		constructor() {
			super("requisition", onMutation$1, false, onReqPageRefreshed);
		}
		isPageReallyLoaded() {
			return isPageProbablyLoaded$1();
		}
	};
	var ViewReqObserver = class extends PartialUrlObserver {
		constructor() {
			super("viewRequisition", onViewMutation, false, onViewReqPageRefreshed);
		}
		isPageReallyLoaded() {
			return isPageProbablyLoaded$1();
		}
	};
	var observer_default = {
		viewReqObserver: new ViewReqObserver(),
		requisitionObserver: new RequisitionObserver()
	};
	function onReqPageRefreshed() {
		gringo("page Aanvraag refreshed.");
		decorateReqPage();
	}
	function onViewReqPageRefreshed() {
		gringo("page Aanvraag refreshed.");
		decorateViewReqPage();
	}
	function isPageProbablyLoaded$1() {
		return true;
	}
	function onMutation$1(mutation) {
		decorateReqPage().then(() => {});
		return false;
	}
	function onViewMutation(mutation) {
		decorateViewReqPage().then(() => {});
		return false;
	}
	let pr = null;
	function getUrlPrId() {
		return location.pathname.split("/").pop();
	}
	async function decorateViewReqPage() {
		let sectionMain = document.querySelector(`section[role="main"]`);
		if (!sectionMain) return;
		if (getAndSetDecorated(sectionMain)) return;
		gringo("Decorating view aanvraag page...");
		location.pathname.includes("viewRequisition");
		pr = await fetchPr(getUrlPrId());
		if (!pr) return;
		let compactPr = {
			prId: pr.reqId,
			items: pr.lineItems.map((item) => {
				return {
					commodityCode: getPrItemCommodity(item)?.code ?? "",
					price: item.price.value.amount,
					quantity: item.quantity.value,
					currency: item.price.value.currency,
					currencySymbol: item.price.value.currencySymbol
				};
			})
		};
		let totalPriceDiv = document.querySelector("div.block-heading.total-price");
		totalPriceDiv.style.display = "none";
		emmet.insertAfter(totalPriceDiv, `
        div.newTotal.gringo>(
            div.newTotal.block-heading.total-price{Totale kosten}+
            div.blueBlock.flexRow.w100.mbe-1ch>(
                label{Bruto bedrag}+
                div.newTotalBruto.pull-end{€---,--- EUR}
            )
        )
    `);
		await updatePr(await createExpandedCompactPr(compactPr));
	}
	function createCompactReqItem(item) {
		return {
			commodityCode: getPrItemCommodity(item)?.code ?? "",
			price: item.price.value.amount,
			quantity: item.quantity.value,
			currency: item.price.value.currency,
			currencySymbol: item.price.value.currencySymbol
		};
	}
	function createCompactPr(pr) {
		let items = [];
		if (pr.lineItems) items = pr.lineItems.map((item) => {
			return createCompactReqItem(item);
		});
		return {
			prId: pr.reqId,
			items
		};
	}
	function createCompactReqItemFromCartItem(item) {
		return {
			commodityCode: item.itemCommodityCode,
			price: item.unitPrice,
			quantity: item.quantity,
			currency: item.unitPriceMoney.currency,
			currencySymbol: item.unitPriceMoney.currencySymbol
		};
	}
	async function decorateReqPage() {
		let sectionMain = document.querySelector(`section[role="main"]`);
		if (!sectionMain) return;
		if (getAndSetDecorated(sectionMain)) return;
		gringo("Decorating aanvraag page...");
		let prId = getUrlPrId();
		let contextPrId = (await fetchReqContext()).requisitionId;
		let cart = await fetchShoppingCart();
		let compactPr;
		if (prId == contextPrId && cart.length != 0) compactPr = {
			prId: contextPrId,
			items: cart.map((item) => {
				return createCompactReqItemFromCartItem(item);
			})
		};
		else {
			pr = await fetchPr(prId);
			if (!pr) return;
			compactPr = createCompactPr(pr);
		}
		let totalPriceDiv = document.querySelector("div.block-heading.total-price");
		totalPriceDiv.style.display = "none";
		emmet.insertAfter(totalPriceDiv, `
        div.newTotal.gringo>(
            div.newTotal.block-heading.total-price{Totale kosten}+
            div.blueBlock.flexRow.w100.mbe-1ch>(
                label{Bruto bedrag}+
                div.newTotalBruto.pull-end{€---,--- EUR}
            )
        )
    `);
		await updatePr(await createExpandedCompactPr(compactPr));
	}
	function calcPrTotal(pr) {
		let total = 0;
		let currencySymbel = "€";
		let currency = "EUR";
		for (let item of pr.items) {
			if (!item.tarif) {
				total = 0;
				break;
			}
			total += calcBrutoLinePrice(item.item, item.tarif.tarif);
		}
		return {
			total,
			currencySymbel,
			currency
		};
	}
	function updateTotalBruto(pr) {
		let newTotal = document.querySelector("div.newTotalBruto");
		let { total, currencySymbel, currency } = calcPrTotal(pr);
		newTotal.textContent = `${currencySymbel}${priceFormatter.format(total)}  ${currency}`;
	}
	async function updatePr(pr) {
		updateTotalBruto(pr);
		let nonDecoratedItems = [...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)];
		for (let index = 0; index < nonDecoratedItems.length; index++) {
			let itemEl = nonDecoratedItems[index];
			await decoratePrItem(pr, itemEl, index);
		}
	}
	let priceFormatter = new Intl.NumberFormat("nl-BE", {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2
	});
	function calcBrutoLinePrice(item, tarif) {
		let bruto = null;
		bruto = item.price * item.quantity * (100 + tarif);
		bruto = Math.round(bruto) / 100;
		return bruto;
	}
	async function createExpandedPr(pr) {
		let items = [];
		if (pr.lineItems != null) for (let item of pr.lineItems) {
			let tarif = null;
			let tarifs = await getBtwTarifsCachedInSession();
			let commodity = getPrItemCommodity(item);
			let grant = getPrItemGrant(item);
			let ledger = getPrItemLedger(item);
			if (!ledger) ledger = getPrItemAsset(item);
			let budget = null;
			if (ledger) budget = getBudgetCode(ledger.code);
			tarif = tarifs.get(commodity?.code ?? "") ?? null;
			items.push({
				pr,
				item,
				tarif,
				ledger,
				budget,
				grant
			});
		}
		return {
			pr,
			items
		};
	}
	async function createExpandedCompactPr(pr) {
		let items = [];
		for (let item of pr.items) {
			let tarif = null;
			tarif = (await getBtwTarifsCachedInSession()).get(item.commodityCode) ?? null;
			items.push({
				item,
				tarif
			});
		}
		return {
			pr,
			items
		};
	}
	async function decoratePrItem(pr, lineEl, index) {
		let priceSection = lineEl.querySelector("div.price-section");
		if (!priceSection) return;
		let brutoRow = priceSection.querySelectorAll("div.row")[1];
		let brutoRowChildren = [...brutoRow.children];
		brutoRowChildren.forEach((c) => c.style.display = "none");
		let brutoDiv = brutoRowChildren.pop();
		brutoDiv.style.display = "none";
		brutoRow.querySelector("div.newBruto")?.remove();
		let calcFieldsContainer = emmet.appendChild(brutoRow, `
        div.gringo.newBruto.flexRow.w100.blueBlock
    `).first;
		let calcFields = addNettoAndBrutoFields(45, calcFieldsContainer, pr.items[index]);
		let fieldQuantity = lineEl.querySelector("div.field-quantity");
		let fieldQuantityInput = fieldQuantity.querySelector("input");
		calcFields.entangledFields.add(fieldQuantityInput, (ctx) => {
			if (!ctx.netto) return;
			fieldQuantityInput.value = formatPrice(ctx.netto, "", "").trim();
			triggerFieldChanged(fieldQuantityInput);
		});
		let newTotalDiv = document.querySelector("div.newTotalBruto");
		calcFields.entangledFields.add(newTotalDiv, (ctx) => {
			updateTotalBruto(pr);
		});
		fieldQuantity.classList.add("hidePlusMinButtons");
		updatePrItem(pr, lineEl, index, calcFields);
		let parser = new Parser(fieldQuantityInput.value);
		calcFields.entangledFields.context.netto = parser.parse().result;
		calcFields.entangledFields.setCurrentSource(fieldQuantityInput);
		calcFields.entangledFields.updateOtherFields();
	}
	function updatePrItem(pr, lineEl, index, calcFields) {
		if (pr.items[index].tarif) {
			calcFields.entangledFields.context.btw = pr.items[index].tarif.tarif;
			calcFields.nettoCalcField.postFieldLabelDiv.textContent = calcFields.entangledFields.context.btw.toString() + "%";
		} else {
			calcFields.entangledFields.context.btw = 666;
			calcFields.nettoCalcField.postFieldLabelDiv.textContent = calcFields.entangledFields.context.btw.toString() + "%";
		}
		let btwDif = calcFields.nettoCalcField.postFieldLabelDiv;
		btwDif.textContent = "";
		let txtSelecteer = "--selecteer--";
		emmet.indent.appendChild(btwDif, `
        div
            select
                option[value="${txtSelecteer}"]{${txtSelecteer}}+
                option[value="0"]{0%}+
                option[value="6"]{6%}+
                option[value="12"]{12%}+
                option[value="21"]{21%}
            button.btwSave.m1{Bewaar voor dit artikel}
    `);
		let select = btwDif.querySelector("select");
		select.value = pr.items[index].tarif ? pr.items[index].tarif.tarif.toString() : txtSelecteer;
		select.onchange = (ev) => {
			onBtwSelectChange(pr, index, lineEl, parseInt(select.value));
		};
		let button = btwDif.querySelector("button.btwSave");
		button.onclick = async (ev) => {
			await btnCreateTarifClick(select, txtSelecteer, pr, index, lineEl, calcFields);
		};
	}
	function onBtwSelectChange(pr, index, lineEl, tarif) {
		console.log("onBtwSelectChange: todo: update CalcFields ctx.btw");
	}
	async function btnCreateTarifClick(select, txtSelecteer, pr, index, lineEl, calcFields) {
		let selected = select.value;
		if (selected == txtSelecteer) return;
		let commodity = pr.items[index].item.commodityCode;
		if (commodity == "") {
			alert("Er is geen 'Commodity-code' (zie sectie Overig) voor dit artikel.");
			return;
		}
		let tarifs = await getBtwTarifsCachedInSession();
		tarifs.set(commodity, {
			commodityCode: commodity,
			description: "",
			tarif: parseInt(selected)
		});
		await uploadBtwTarifs(tarifs);
		pr = await createExpandedCompactPr(pr.pr);
		updatePrItem(pr, lineEl, index, calcFields);
	}
	//#endregion
	//#region typescript/tabs.ts
	var Tabs = class {
		tabDefs;
		tabs;
		beforeTabSwitch;
		constructor(parent, tabDefs, beforeTabSwitch) {
			this.tabDefs = tabDefs;
			this.beforeTabSwitch = beforeTabSwitch ?? null;
			this.tabs = emmet.appendChild(parent, "div.tabs").first;
			for (let tabDef of tabDefs) {
				let button = emmet.appendChild(this.tabs, `
            button#${tabDef.btnId}.naked.hand.tab.notSelected[data-tab-id="${tabDef.tabId}"]
        `).first;
				if (typeof tabDef.btnContent == "string") button.innerHTML = tabDef.btnContent;
				else button.appendChild(tabDef.btnContent);
			}
			this.addNavigation();
		}
		switch(to) {
			let btn;
			if (typeof to == "number") btn = document.getElementById(this.tabDefs[to].btnId);
			else btn = to;
			let tabId = btn.dataset.tabId;
			btn.parentElement.querySelectorAll(".tab").forEach((tab) => {
				tab.classList.add("notSelected");
				document.getElementById(tab.dataset.tabId).style.display = "none";
			});
			btn.classList.remove("notSelected");
			document.getElementById(tabId).style.display = "block";
		}
		addNavigation() {
			document.querySelectorAll(".tabs > button.tab").forEach((btn) => btn.addEventListener("click", (ev) => {
				let button = ev.currentTarget;
				if (this.beforeTabSwitch?.(button, button.dataset.tabId) != "cancel") this.switch(ev.currentTarget);
			}));
		}
	};
	//#endregion
	//#region typescript/db/localStorage.ts
	function getBudgetSubGroupings() {
		let groupings = localStorage.getItem("budgetSubGroupings");
		if (!groupings) return [];
		return JSON.parse(groupings);
	}
	function saveBudgetSubGroupings(groupings) {
		localStorage.setItem("budgetSubGroupings", JSON.stringify(groupings));
	}
	const storage = { local: {
		getBudgetSubGroupings,
		saveBudgetSubGroupings
	} };
	//#endregion
	//#region typescript/aanvragen/totalsTab.ts
	async function fillTotalsTab() {
		hideFloatingHelp();
		let totalsTab = document.querySelector("div.gringo.totalsTab");
		totalsTab.innerHTML = "";
		emmet.appendChild(totalsTab, `
        (button.naked.refresh>i.fa.fa-repeat)+
        (button.naked.copyToClipboard>i.fa.fa-copy)+
        div.infoContainer+
        div.tabsContainer+
        div.popoversContainer
    `);
		let popoversContainer = totalsTab.querySelector("div.popoversContainer");
		let button = totalsTab.querySelector("button.refresh");
		button.onclick = (ev) => onRefreshClicked(ev);
		button = totalsTab.querySelector("button.copyToClipboard");
		button.onclick = (ev) => onCopyToClipboardClicked(ev);
		let infoContainer = totalsTab.querySelector("div.infoContainer");
		let tabsContainer = totalsTab.querySelector("div.tabsContainer");
		let infoBlock = createInfoBlock(infoContainer);
		infoBlock.title.textContent = "Totalen";
		infoBlock.info.textContent = "Ophalen van gegevens....";
		emmet.appendChild(tabsContainer, `
        div.perProjectTab+div.perBudgetTab
    `);
		let tabs = new Tabs(tabsContainer, [{
			btnId: "btnTabPerProject",
			tabId: "tabPerProject",
			btnContent: "Per project"
		}, {
			btnId: "btnTabPerBudget",
			tabId: "tabPerBudget",
			btnContent: "Per budget"
		}]);
		emmet.appendChild(tabsContainer, `
        div#tabPerProject+
        div#tabPerBudget
    `);
		let tabPerProject = tabsContainer.querySelector("div#tabPerProject");
		let tabPerBudget = tabsContainer.querySelector("div#tabPerBudget");
		tabs.switch(0);
		let expenses = await getExpenses(infoBlock);
		expenses.sort((a, b) => a.budget.localeCompare(b.budget));
		infoBlock.info.innerHTML = "";
		await displayPerProject(tabPerProject, {
			title: "Per project",
			groups: await createProjectItemGroups(expenses),
			addBelowTabTitle: null
		});
		let tabDataBudget = {
			title: "Per budget",
			groups: await createBudgetItemGroups(expenses),
			addBelowTabTitle: null
		};
		tabDataBudget.addBelowTabTitle = async () => {
			return await addHtmlBelowTabTitleForBudget(tabPerBudget, tabDataBudget);
		};
		let budgetItemGroups = await displayPerBudget(tabPerBudget, tabDataBudget);
		await createPopovers(popoversContainer, expenses);
		let cloudBudgets = {
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			perBudget: budgetItemGroups.groups.map((group) => {
				return {
					budget: group.groupId,
					grant: "todo!!!",
					total: group.total
				};
			})
		};
		await cloud.json.upload(KEY_CLOUD_GRINGO_FOLDER + "expenses/Academie_Berchem_2026_expenses.json", cloudBudgets);
	}
	async function onRefreshClicked(ev) {
		sessionStorage.removeItem("jsonPrData");
		await fillTotalsTab();
	}
	async function onCopyToClipboardClicked(ev) {}
	async function createProjectItemGroups(expenses) {
		return [...(await getItemsPerGroup(expenses, async (item) => {
			return (await fetchMetaCached(item.prId)).project ?? "";
		}, (await getGlobalSettingsCached()).projects)).entries()].map((mappedItem) => {
			let groupId = mappedItem[0];
			let items = mappedItem[1].map((item) => {
				return {
					item,
					division: 1
				};
			});
			let dscr = groupId;
			let total = items.map((i) => i.item.bruto).reduce((a, b) => a + b, 0);
			return {
				level: 0,
				groupId,
				items,
				dscr: groupId == "" ? "--nog geen project--" : dscr,
				total,
				children: []
			};
		});
	}
	function calcTotal(items) {
		return items.map((i) => i.item.bruto / i.division).reduce((a, b) => a + b, 0);
	}
	async function createBudgetItemGroups(expenses) {
		let budgetItemGroups = [...(await getItemsPerGroup(expenses, async (item) => {
			return item.budget;
		}, [])).entries()].map((mappedItem) => {
			let groupId = mappedItem[0];
			let items = mappedItem[1].map((item) => {
				return {
					item,
					division: 1
				};
			});
			let dscr = groupId + " " + (getBudgetDscr(groupId) ?? "--geen omschrijving--");
			let total = calcTotal(items);
			return {
				level: 0,
				groupId,
				items,
				dscr: groupId == "" ? "--nog geen budget--" : dscr,
				total,
				children: []
			};
		});
		let groupSettings = storage.local.getBudgetSubGroupings();
		for (let itemGroup of budgetItemGroups) await createBudgetSubGroupings(itemGroup, groupSettings);
		return budgetItemGroups;
	}
	async function createBudgetSubGroupings(items, groupSettings) {
		let tagSet = new Set(groupSettings.filter((group) => group.groupingType == "tag").map((group) => group.name));
		for (let groupTag of tagSet.values()) {
			let groupItems = [];
			for (let item of items.items) {
				if (!item.tags) {
					let meta = await fetchMetaCached(item.item.prId);
					item.tags = new Set(meta.tags);
				}
				let matchingTags = tagSet.intersection(item.tags);
				if (matchingTags.has(groupTag)) {
					item.division = matchingTags.size;
					groupItems.push(item);
				}
			}
			items.children.push({
				level: 1,
				groupId: groupTag,
				items: groupItems,
				dscr: groupTag,
				total: calcTotal(groupItems),
				children: []
			});
		}
		let groupedIds = new Set(items.children.map((g) => g.items.map((i) => i.item.prId)).flat());
		items.items = items.items.filter((i) => !groupedIds.has(i.item.prId));
	}
	async function createPopovers(popoversContainer, expenses) {
		for (let item of expenses) {
			let meta = await fetchMetaCached(item.prId);
			let itemId = item.prId + "_" + item.itemNo;
			let popover = emmet.appendChild(popoversContainer, `
            div#popover${itemId}.gringoPopover[popover="" style="position-anchor: --anchor${itemId};"]>(
                div.content>(
                    button.naked.goto{${item.prId}}+
                    div{budget:${item.budget}}+
                    div.tagsContainer+
                    div.metaFieldsContainer
                )
            )
        `).first;
			let button = popover.querySelector("button.goto");
			button.onclick = () => {
				window.open(`https://s1-eu.ariba.com/gb/viewRequisition/${item.prId}`, "_blank").focus();
			};
			await displayMetaFields(popover.querySelector(".metaFieldsContainer"), meta, async (meta) => {
				await updateRelatedItemPopover(item.prId, meta);
			});
			await updateMetaFields(popover, meta);
		}
	}
	async function displayPerProject(wrapper, tabData) {
		emmet.appendChild(wrapper, `h2{${tabData.title}}`);
		let container = emmet.appendChild(wrapper, "div.perProject").first;
		for (let project of tabData.groups) displayGroupedBlock(project, container);
	}
	async function getGlobalTagsAndAndere() {
		let globalTags = await getGlobalTags();
		let alltags = structuredClone(globalTags);
		let andereTag = {
			name: "(andere)",
			description: "",
			bkgColor: "",
			color: "",
			order: 9999
		};
		alltags.set(andereTag.name, andereTag);
		return alltags;
	}
	async function fillBudgetLines(container, tabDef) {
		container.innerHTML = "";
		let subGroepLabels = storage.local.getBudgetSubGroupings().filter((s) => s.groupingType == "tag").map((s) => {
			return `+span.price{${s.name}}`;
		}).join("");
		emmet.appendChild(container, `
        div.flexRow.totalsHeader>(
            span.dscr+
            span.price{Totaal}
            ${subGroepLabels}
        )
    `);
		for (let itemGroup of tabDef.groups) displayGroupedBlock(itemGroup, container);
		return tabDef;
	}
	async function addHtmlBelowTabTitleForBudget(wrapper, tabData) {
		let subGroupsCollapse = emmet.appendChild(wrapper, `
        details.subGroups>
            summary{Ondergroeperingen}+
            div.subGroupsContainer
    `).first;
		let container = emmet.appendChild(wrapper, "div.perProject").first;
		let subGroupsContainer = subGroupsCollapse.querySelector(".subGroupsContainer");
		let tbody = emmet.appendChild(subGroupsContainer, "table.budgetGroupings>tbody").last;
		[...(await getGlobalTagsAndAndere()).values()].sort((a, b) => a.order - b.order).forEach((tagDef) => {
			createTagFilterRow$1(tbody, tagDef, container, tabData);
		});
		updateGroupingsFilters(storage.local.getBudgetSubGroupings());
		return container;
	}
	async function displayPerBudget(wrapper, tabData) {
		emmet.appendChild(wrapper, `h2{${tabData.title}}`);
		return await fillBudgetLines(await tabData.addBelowTabTitle?.(), tabData);
	}
	async function createTagFilterRow$1(tbody, tagDef, container, tabData) {
		let tr = emmet.appendChild(tbody, `tr`).first;
		tr.dataset.groupName = tagDef.name;
		emmet.appendChild(tr, `
                (td>span.naked.gringoTag{${tagDef.name}})+
                (td>button.naked.filter>(
                    span.equal{✔}+
                    span.empty{▢}
                    )
                )
            `);
		paintTag(tr.querySelector("span"), tagDef, true);
		let filterButton = tr.querySelector("button.filter");
		filterButton.onclick = async (ev) => {
			let groupings = storage.local.getBudgetSubGroupings();
			if (!groupings.find((g) => g.name == tagDef.name)) {
				let grouping = {
					groupingType: "tag",
					name: tagDef.name
				};
				groupings.push(grouping);
			} else groupings = groupings.filter((g) => g.name != tagDef.name);
			storage.local.saveBudgetSubGroupings(groupings);
			updateGroupingsFilters(groupings);
			await fillBudgetLines(container, tabData);
		};
	}
	function updateGroupingsFilters(groupings) {
		let table = document.querySelector("table.budgetGroupings");
		for (let tr of table.tBodies[0].rows) {
			let groupName = tr.dataset.groupName;
			let group = groupings.find((g) => g.name == groupName);
			let btnGroup = tr.querySelector("button.filter");
			btnGroup.classList.toggle("equal", !!group);
			btnGroup.classList.toggle("empty", !group);
		}
	}
	function displayGroupedBlock(itemGroup, container) {
		let subGroupPriceSpans = itemGroup.children.map((subGroup) => {
			return `+span.price{${formatPrice(subGroup.total)}}`;
		}).join("");
		let details = emmet.appendChild(container, `
        div.details.midBlue.indent${itemGroup.level}>
            div.summary>
                div.group.flexInline>(
                    span.dscr{${itemGroup.dscr}}+
                    span.price{${formatPrice(itemGroup.total)}}
                    ${subGroupPriceSpans}                    
                )
        `).first;
		itemGroup.items.sort((a, b) => a.item.prId.localeCompare(b.item.prId));
		for (let item of itemGroup.items) displayItem(details, item);
		details.querySelectorAll(":scope > .summary").forEach((s) => {
			s.onclick = () => {
				s.parentElement.classList.toggle("open");
			};
		});
		for (let child of itemGroup.children) displayGroupedBlock(child, details);
	}
	function formatSplitItemPrice(item) {
		if (item.division > 1) return `${formatPrice(item.item.bruto, "")}/${item.division} = ${formatPrice(item.item.bruto / item.division)}`;
		else return formatPrice(item.item.bruto / item.division);
	}
	function displayItem(details, item) {
		let itemId = item.item.prId + "_" + item.item.itemNo;
		emmet.appendChild(details, `
        div.item.flexRow.w100>(
            (
                span>(
                    (
                        button.naked.midBlueText[popovertarget="popover${itemId}" style="anchor-name: --anchor${itemId};"]{${item.item.prId}}
                    )+
                    span.descr{${item.item.title}}
                )
            )+
            span.price{${formatSplitItemPrice(item)}}
        )
    `).first;
	}
	async function updatePopover(popover, meta) {
		await displayTags(popover.querySelector(".tagsContainer"), meta);
	}
	async function updateRelatedItemPopover(prId, meta) {
		let popovers = document.querySelectorAll("div.totalsTab div.item div.gringoPopover");
		for (let popover of [...popovers].filter((p) => p.id.includes("popover" + prId))) await updatePopover(popover, meta);
	}
	//#endregion
	//#region typescript/aanvragen/observer.ts
	var AanvragenObserver = class extends PartialUrlObserver {
		constructor() {
			super("request-info-list/requisition", onMutation, false, onPageRefreshed$1);
		}
		isPageReallyLoaded() {
			return isPageProbablyLoaded();
		}
	};
	var RecentRequestsObserver = class extends PartialUrlObserver {
		constructor() {
			super("request-info-list/recentrequests", onRecentRequestMutation, false, onRecentRequestPageRefreshed);
		}
		isPageReallyLoaded() {
			return isPageProbablyLoaded();
		}
	};
	let requestObservers = {
		aanvragenObserver: new AanvragenObserver(),
		recentRequestsObsverver: new RecentRequestsObserver()
	};
	function onPageRefreshed$1() {
		gringo("page Aanvragen refreshed xxx.");
		checkDecorations();
	}
	function onRecentRequestPageRefreshed() {
		checkRecentRequestsDecorations();
	}
	function isPageProbablyLoaded() {
		return !!getPagination();
	}
	function onMutation(mutation) {
		checkDecorations();
		return false;
	}
	function onRecentRequestMutation(mutation) {
		checkRecentRequestsDecorations();
		return false;
	}
	function checkAndSetListPageDecorated(el) {
		let input = el;
		let isDecorated = el.dataset.gringoCurrentPage == input.value;
		el.dataset.gringoCurrentPage = input.value;
		return isDecorated;
	}
	function checkandGetTabsFilled() {
		let tabs = document.querySelector("nav.requests-nav div.tablist-element");
		if (tabs?.querySelectorAll("div").length == 0) return null;
		return tabs;
	}
	function checkDecorations() {
		checkAndSetDecoration(document.querySelector("body"), decorateBody);
		checkAndSetDecoration(document.querySelector("main"), decorateMain);
		checkAndSetDecoration(checkandGetTabsFilled(), decorateTabs);
		checkAndSetDecoration(document.querySelector(".request-search-panel"), decorateSearchPanel);
		checkAndSetDecoration(getListTabDecoratedElement(), decorateRequestList, checkAndSetListPageDecorated);
	}
	function decorateBody() {
		emmet.appendChild(document.body, `
        div#gringo-tags-popover[popover=""]> (
            (div.flexRow>button.closePopup.naked{x})+
            div.popoverContainer{Container...}
        )        
    `);
	}
	function checkRecentRequestsDecorations() {
		checkAndSetDecoration(document.querySelector("body"), decorateBody);
		checkAndSetDecoration(document.querySelector("main"), decorateMain);
		checkAndSetDecoration(document.querySelector("nav.requests-nav div.tablist-element"), decorateTabs);
	}
	function getPagination() {
		let paginationElement = document.querySelector("fd-pagination");
		if (!paginationElement) return null;
		let currentPageElement = paginationElement.querySelector("input");
		if (!currentPageElement) return {
			currentPage: 1,
			currentPageElement: null,
			hasNext: false
		};
		let currentPage = parseInt(currentPageElement.value);
		let nextButton = paginationElement.querySelector("button[glyph='navigation-right-arrow']");
		if (!nextButton) return null;
		return {
			currentPage,
			currentPageElement,
			hasNext: nextButton.classList.contains("is-disabled")
		};
	}
	function getListTabDecoratedElement() {
		if (!document.querySelector("request-info-requisitions")) return null;
		return getPagination()?.currentPageElement ?? null;
	}
	let globalPrs = [];
	async function applyFilters(requests) {
		gringo("Applying filters...");
		let filters = getTagsFilters();
		let selectedTags = filters.filter((t) => t.filterType == "==");
		let excludedTags = filters.filter((t) => t.filterType == "!=");
		for (let request of requests) {
			let reqDiv = document.getElementById("request-" + request.id);
			if (!reqDiv) continue;
			let meta = await fetchMetaCached(request.id);
			let hasAllSelectedTags = selectedTags.every((t) => meta.tags.includes(t.name));
			let hasNoExcludedTags = excludedTags.every((t) => !meta.tags.includes(t.name));
			reqDiv.classList.toggle("hidden", !(hasAllSelectedTags && hasNoExcludedTags));
		}
	}
	function decorateRequestList() {
		let main = document.querySelector("main");
		if (!main) return;
		main.classList.toggle("hideOnBehalfOf", true);
		main.classList.toggle("hideTeam", true);
		let requests = scrapePRs();
		fetchChangedMetas().then(async (changedFiles) => {
			gringo(changedFiles);
			await saveMetasLocal(changedFiles.map((f) => f.data));
			requests.forEach(decoratePr);
			await applyFilters(requests);
		});
		let button = document.getElementById("gringo-tags-popover").querySelector("button.closePopup");
		addButtonClickNoPropagation(button, (ev) => {
			let popover = document.getElementById("gringo-tags-popover");
			if (!popover) return;
			popover.togglePopover({ source: button });
		});
	}
	function updateTagsFilters(filters) {
		let table = document.getElementById("tagsFilterTable");
		for (let tr of table.tBodies[0].rows) {
			let tagName = tr.dataset.tagName;
			let filter = filters.find((f) => f.name == tagName);
			let btnFilter = tr.querySelector("button.filter");
			if (!filter) {
				btnFilter.classList.toggle("equal", false);
				btnFilter.classList.toggle("notEqual", false);
				btnFilter.classList.toggle("empty", true);
				continue;
			}
			btnFilter.classList.toggle("empty", false);
			btnFilter.classList.toggle("equal", filter.filterType == "==");
			btnFilter.classList.toggle("notEqual", filter.filterType == "!=");
		}
	}
	function createTagFilterRow(tbody, tagDef) {
		let tr = emmet.appendChild(tbody, `tr`).first;
		tr.dataset.tagName = tagDef.name;
		emmet.appendChild(tr, `
                (td>span.naked.gringoTag{${tagDef.name}})+
                (td>button.naked.filter>(
                    span.equal{✔}+
                    span.notEqual{❌}+
                    span.empty{▢}
                    )
                )
            `);
		paintTag(tr.querySelector("span"), tagDef, true);
		let filterButton = tr.querySelector("button.filter");
		filterButton.onclick = async (ev) => {
			let filters = getTagsFilters();
			let filter = filters.find((t) => t.name == tagDef.name);
			if (!filter) {
				let filter = {
					name: tagDef.name,
					filterType: "=="
				};
				filters.push(filter);
			} else if (filter.filterType == "==") filter.filterType = "!=";
			else filters = filters.filter((f) => f.name != tagDef.name);
			saveTagsFilters(filters);
			updateTagsFilters(filters);
			await applyFilters(globalPrs);
		};
	}
	function decorateTabs(el) {
		[...el.querySelectorAll("div:not(.gringo).fd-tabs__item")].forEach((tab) => {
			tab.addEventListener("click", (ev) => {
				document.querySelector("main").classList.remove("hide");
				document.querySelector("div.gringo.totalsTab").classList.add("hide");
				[...document.querySelectorAll("div.fd-tabs__item")].forEach((tab2) => {
					tab2.children[0].setAttribute("aria-selected", "false");
					tab2.children[0].classList.remove("is-selected");
				});
				ev.currentTarget.children[0].setAttribute("aria-selected", "true");
				ev.currentTarget.children[0].classList.add("is-selected");
			});
		});
		emmet.appendChild(el, `
        div.fd-tabs__item.totalsTab>
            button.noBkg.fd-tabs__link>
                span.fd-tabs__tag{Totalen}
    `);
		let button = el.querySelector("button");
		button.onclick = () => {
			onTabButtonClick(el);
		};
	}
	function decorateMain(el) {
		emmet.insertAfter(el, `
        div.gringo.totalsTab.hide{Tadaaaa!}    
    `);
	}
	function onTabButtonClick(tabContainer) {
		let tabs = [...tabContainer.querySelectorAll("div.fd-tabs__item")];
		tabs.forEach((tab) => {
			tab.children[0].setAttribute("aria-selected", "false");
			tab.children[0].classList.remove("is-selected");
		});
		tabs.pop().children[0].setAttribute("aria-selected", "true");
		document.querySelector("div.gringo.totalsTab").classList.remove("hide");
		document.querySelector("main").classList.add("hide");
		fillTotalsTab();
	}
	async function decorateSearchPanel() {
		let requestSearchPanel = document.querySelector(".request-search-panel");
		let divSearchPanel = document.querySelector(`div.gringoSearchPanel`);
		if (!divSearchPanel) divSearchPanel = emmet.insertAfter(requestSearchPanel, `div.gringoSearchPanel`).first;
		divSearchPanel.innerHTML = "";
		let tagsCollapse = emmet.appendChild(divSearchPanel, `
        details>(
            summary{Tags}+
            table#tagsFilterTable>tbody
        )    
    `).first;
		let tbody = tagsCollapse.querySelector("tbody");
		[...(await getGlobalTags()).values()].sort((a, b) => a.order - b.order).forEach((tagDef) => {
			createTagFilterRow(tbody, tagDef);
		});
		updateTagsFilters(getTagsFilters());
		let infoBlock = createInfoBlock(divSearchPanel);
		let btnTestFetch = emmet.appendChild(tagsCollapse, `div>button#btnTestFetch{TEST Fetch last clicked}`).last;
		let ctx = {
			counter: 0,
			infoBlock
		};
		btnTestFetch.onclick = async (ev) => {
			if (globalLastRequestTagsClicked) await fetchFullRequest(globalLastRequestTagsClicked.id, ctx);
		};
		let btnTestRequestList = emmet.appendChild(tagsCollapse, `div>button#btnTestRequestList{TEST Fetch all}`).last;
		btnTestRequestList.onclick = async (ev) => {
			await fetchRequestList();
		};
		let btnTestRequestListAndDetails = emmet.appendChild(tagsCollapse, `div>button#btnTestRequestListAndDetails{TEST Fetch all with details}`).last;
		btnTestRequestListAndDetails.onclick = async (ev) => {
			await fetchRequestListAndDetails(infoBlock);
		};
		let btnTestExportToExcel = emmet.appendChild(tagsCollapse, `div>button#btnTestExportToExcel{TEST Export to Excel}`).last;
		btnTestExportToExcel.onclick = async (ev) => {
			await exportPrItemsToExcel(infoBlock);
		};
		function onAribaFilterButton() {
			let inputCurrentPage = getListTabDecoratedElement();
			if (!inputCurrentPage) return;
			inputCurrentPage.dataset.gringoCurrentPage = "";
		}
		[...requestSearchPanel.querySelectorAll(".search-button-container button")].forEach((button) => {
			button.addEventListener("click", onAribaFilterButton);
		});
	}
	function scrapePRs() {
		gringo("Scraping...");
		let infos = [...document.querySelectorAll("request-info-item")].map(scrapeInfoItem);
		gringo(`Found ${infos.length} items.`);
		if (infos.length > 0) document.body.dataset.gringoPageScraped = "true";
		globalPrs = infos;
		return globalPrs;
	}
	function scrapeInfoItem(requestDiv) {
		let id = requestDiv.id.substring(8);
		let divOrders = requestDiv.querySelector(".item-orders");
		let orderAnchors = [];
		if (divOrders) orderAnchors = [...divOrders.querySelectorAll(".request-po-list-container ul > li a")];
		return {
			id,
			orderAnchors
		};
	}
	function addOrderCopyButton(request) {
		request.orderAnchors.forEach((a) => {
			let button = emmet.insertAfter(a, `
            button.copyAnchorText.naked
                >li.far.fa-copy 
            `).first;
			addButtonClickNoPropagation(button, async (ev) => {
				await navigator.clipboard.writeText(a.innerText);
			});
		});
	}
	function addButtonClickNoPropagation(button, onClick) {
		button.onmousedown = async (ev) => {
			ev.stopPropagation();
			ev.preventDefault();
		};
		button.onmouseup = (ev) => {
			onClick(ev);
			ev.stopPropagation();
			ev.preventDefault();
		};
		button.onclick = (ev) => {
			ev.stopPropagation();
			ev.preventDefault();
		};
	}
	async function decoratePr(request) {
		let reqDiv = document.getElementById("request-" + request.id);
		if (!reqDiv) return;
		if (reqDiv.dataset.gringo == "decorated") return;
		reqDiv.dataset.gringo = "decorated";
		addOrderCopyButton(request);
		let meta = await fetchMetaCached(request.id);
		await decoratePrWithMeta(request, meta);
		await updatePrLine(request, meta);
	}
	function getTagsFilters() {
		let json = localStorage.getItem("gringo.tagsFilters");
		if (!json) return [];
		return JSON.parse(json);
	}
	function saveTagsFilters(tagsFilters) {
		localStorage.setItem("gringo.tagsFilters", JSON.stringify(tagsFilters));
	}
	async function displayTags(tagsContainer, meta) {
		tagsContainer.innerHTML = "";
		let globalTagsMap = await getGlobalTags();
		meta.tags.map((tag) => {
			return globalTagsMap.get(tag);
		}).filter((t) => !!t).sort((a, b) => a.order - b.order).forEach((tagDef) => {
			let tagSpan = emmet.appendChild(tagsContainer, `
                span    
            `).first;
			paintTag(tagSpan, tagDef, true);
		});
		let orphans = meta.tags.filter((tag) => ![...globalTagsMap.values()].find((tagDef) => tagDef.name == tag));
		if (orphans.length > 0) emmet.appendChild(tagsContainer, orphans.map((tag) => `span.gringoTag{${tag}}`).join("+"));
	}
	async function updateMetaFields(metaWrapper, meta) {
		await displayTags(metaWrapper.querySelector(".tagsContainer"), meta);
		let select = metaWrapper.querySelector("div.projectWrapper select");
		if (meta.project) select.value = meta.project;
	}
	async function updatePrLine(request, meta) {
		let reqDiv = document.getElementById("request-" + request.id);
		if (!reqDiv) return;
		let metaWrapper = reqDiv.querySelector(".metaWrapper");
		if (!metaWrapper) return;
		await updateMetaFields(metaWrapper, meta);
		let newTotal = reqDiv.querySelector("div.gringo.listRowTotal");
		let pr = await fetchPr(request.id);
		let { total, currencySymbel } = calcPrTotal(await createExpandedCompactPr(createCompactPr(pr)));
		if (total != 0) {
			newTotal.textContent = `${currencySymbel}${priceFormatter$1.format(total)}`;
			newTotal.style.display = "block";
		} else {
			newTotal.style.display = "none";
			gringo(`price is 0 for ${request.id}`, request, pr);
		}
	}
	function paintTag(tagElement, tagDef, selected) {
		tagElement.innerText = tagDef.name;
		tagElement.classList.add("gringoTag");
		tagElement.style.color = tagDef.color != "" ? tagDef.color : "inherit";
		tagElement.style.backgroundColor = tagDef.bkgColor != "" ? tagDef.bkgColor : "inherit";
		tagElement.title = tagDef.description;
		tagElement.classList.toggle("selected", selected);
	}
	let globalLastRequestTagsClicked = null;
	async function displayMetaFields(container, meta, afterMetaChange) {
		let metaWrapper = emmet.appendChild(container, `
        div.metaWrapper>(
            (
                div.tagsWrapper.flexRow>(
                    (button.naked.tagButton
                        >li.far.fa-circle-down)+
                    div.tagsContainer
                )
            )+
            (
                div.projectWrapper.flexRow>(
                    select
                )
            )    
        )
    `).first;
		let button = metaWrapper.querySelector("button.tagButton");
		button.onclick = (ev) => {
			onTagButtonClick(meta, button, afterMetaChange);
		};
		let select = container.querySelector("select");
		let options = ["--selecteer--", ...(await getGlobalSettingsCached()).projects];
		for (let option of options) {
			let optionEl = document.createElement("option");
			optionEl.textContent = option;
			optionEl.value = option;
			select.appendChild(optionEl);
		}
		select.onchange = async (ev) => {
			await onSelectProjectClick(meta, select);
		};
		return metaWrapper;
	}
	async function decoratePrWithMeta(request, meta) {
		let reqDiv = document.getElementById("request-" + request.id);
		if (!reqDiv) return;
		let divStatusContainer = reqDiv.querySelector("div.item-status-container");
		if (!divStatusContainer) return;
		divStatusContainer = divStatusContainer.parentElement;
		let metaWrapper = await displayMetaFields(divStatusContainer, meta, async (meta) => {
			await updatePrLine(request, meta);
		});
		metaWrapper.onmousedown = metaWrapper.onmouseup = metaWrapper.onclick = (ev) => {
			ev.stopPropagation();
		};
		let reqItem = document.getElementById("requisition-item-" + request.id);
		if (!reqItem) return;
		let lastField = reqItem.querySelector(":scope > div.last-field");
		lastField.style.fontSize = ".6rem";
		let moneyAmount = lastField.querySelector("span.money-amount");
		emmet.insertAfter(moneyAmount, `
        div.gringo.blueBlock.listRowTotal{€-.---,--}    
    `);
	}
	async function onSelectProjectClick(meta, select) {
		meta.project = select.value;
		await saveMeta(meta.prId, meta, "localStorage and cloud");
	}
	async function onTagButtonClick(meta, button, afterMetaChange) {
		let popover = document.getElementById("gringo-tags-popover");
		if (!popover) return;
		popover.togglePopover({ source: button });
		let container = popover.querySelector(".popoverContainer");
		container.classList.add("tagList");
		container.innerHTML = "";
		[...(await getGlobalTags()).values()].sort((a, b) => a.order - b.order).forEach((tagDef) => {
			let tagButton = emmet.appendChild(container, `
                    button.naked.gringoTag{${tagDef.name}}
                `).first;
			paintTag(tagButton, tagDef, meta.tags.includes(tagDef.name));
			tagButton.onclick = async (ev) => {
				tagButton.classList.toggle("selected");
				if (tagButton.classList.contains("selected")) meta.tags.push(tagDef.name);
				else meta.tags = meta.tags.filter((t) => t != tagDef.name);
				await saveMeta(meta.prId, meta, "localStorage and cloud");
				await afterMetaChange(meta);
			};
		});
	}
	function hideFloatingHelp() {
		let helpPopup = document.querySelector("div.helplinkContainer");
		helpPopup.style.display = "none";
	}
	//#endregion
	//#region typescript/main.ts
	init();
	function init() {
		getOptions().then(() => {
			chrome.storage.onChanged.addListener((_changes, area) => {
				if (area === "sync") getOptions().then((_r) => {
					onSettingsChanged();
				});
			});
			window.navigation.addEventListener("navigatesuccess", () => {
				onPageChanged();
			});
			registerObserver(requestObservers.aanvragenObserver);
			registerObserver(requestObservers.recentRequestsObsverver);
			registerObserver(observer_default.requisitionObserver);
			registerObserver(observer_default.viewReqObserver);
			registerObserver(observer_default$1);
			onPageChanged();
			if (document.readyState == "complete") {
				console.log("document ready. firing onPageRefreshed.");
				onPageRefreshed();
			} else window.addEventListener("load", () => {
				console.log("load event fired.");
				onPageRefreshed();
			});
		});
	}
	function onSettingsChanged() {
		console.log("on settings changed.");
		for (let observer of settingsObservers) observer();
	}
	function onPageChanged() {
		for (let observer of observers) observer.onPageChanged();
	}
	function onPageRefreshed() {
		for (let observer of observers) observer.onPageRefreshed();
	}
	//#endregion
})();

//# sourceMappingURL=bundle.js.map