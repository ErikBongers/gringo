(function() {
	//#region libs/Emmeter/tokenizer.ts
	const CLOSING_BRACE = "__CLOSINGBRACE__";
	const DOUBLE_QUOTE = "__DOUBLEQUOTE__";
	function tokenize(textToTokenize) {
		let tokens = [];
		let txt = textToTokenize.replaceAll("\\}", CLOSING_BRACE).replaceAll("\\\"", DOUBLE_QUOTE);
		let pos = 0;
		let start = pos;
		function pushToken() {
			if (start != pos) tokens.push(txt.substring(start, pos).replaceAll(CLOSING_BRACE, "}").replaceAll(DOUBLE_QUOTE, "\""));
			start = pos;
		}
		function getTo(to) {
			pushToken();
			do
				pos++;
			while (pos < txt.length && txt[pos] != to);
			if (pos >= txt.length) throw `Missing '${to}' at matching from pos ${start}.`;
			pos++;
			pushToken();
		}
		function getChar() {
			pushToken();
			pos++;
			pushToken();
		}
		while (pos < txt.length) switch (txt[pos]) {
			case "{":
				getTo("}");
				break;
			case "\"":
				getTo("\"");
				break;
			case "#":
				pushToken();
				pos++;
				break;
			case ">":
			case "+":
			case "[":
			case "]":
			case "(":
			case ")":
			case "*":
			case ".":
			case "=":
				getChar();
				break;
			case " ":
			case "\n":
				pushToken();
				start = ++pos;
				break;
			default: pos++;
		}
		pushToken();
		return tokens;
	}
	//#endregion
	//#region libs/Emmeter/html.ts
	let emmet = {
		create,
		append,
		insertBefore,
		insertAfter,
		appendChild,
		test: {
			testEmmet,
			tokenize
		}
	};
	let nested = void 0;
	let lastCreated = void 0;
	function toSelector(node) {
		if (!("tag" in node)) throw "TODO: not yet implemented.";
		let selector = "";
		if (node.tag) selector += node.tag;
		if (node.id) selector += "#" + node.id;
		if (node.classList.length > 0) selector += "." + node.classList.join(".");
		return selector;
	}
	function create(text, onIndex, hook) {
		nested = tokenize(text);
		let root = parse();
		let parent = document.querySelector(toSelector(root));
		if ("tag" in root) root = root.child;
		else throw "root should be a single element.";
		buildElement(parent, root, 1, onIndex, hook);
		return {
			root: parent,
			last: lastCreated
		};
	}
	function append(root, text, onIndex, hook) {
		nested = tokenize(text);
		return parseAndBuild(root, onIndex, hook);
	}
	function insertBefore(target, text, onIndex, hook) {
		return insertAt("beforebegin", target, text, onIndex, hook);
	}
	function insertAfter(target, text, onIndex, hook) {
		return insertAt("afterend", target, text, onIndex, hook);
	}
	function appendChild(parent, text, onIndex, hook) {
		return insertAt("beforeend", parent, text, onIndex, hook);
	}
	function insertAt(position, target, text, onIndex, hook) {
		nested = tokenize(text);
		let tempRoot = document.createElement("div");
		let result = parseAndBuild(tempRoot, onIndex, hook);
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
	function parseAndBuild(root, onIndex, hook) {
		buildElement(root, parse(), 1, onIndex, hook);
		return {
			root,
			last: lastCreated
		};
	}
	function testEmmet(text) {
		nested = tokenize(text);
		return parse();
	}
	function parse() {
		return parsePlus();
	}
	function parsePlus() {
		let list = [];
		while (true) {
			let el = parseMult();
			if (!el) return list.length === 1 ? list[0] : { list };
			list.push(el);
			if (!match("+")) return list.length === 1 ? list[0] : { list };
		}
	}
	function parseMult() {
		let el = parseElement();
		if (!el) return el;
		if (match("*")) {
			let mustBeNumber = nested.shift();
			if (!mustBeNumber) throw "Number expecting after multiplier symbol '*'";
			return {
				count: parseInt(mustBeNumber),
				child: el
			};
		} else return el;
	}
	function parseElement() {
		let el;
		if (match("(")) {
			el = parsePlus();
			if (!match(")")) throw "Expected ')'";
			return el;
		} else {
			let text = matchStartsWith("{");
			if (text) {
				text = stripStringDelimiters(text);
				return { text };
			} else return parseChildDef();
		}
	}
	function parseChildDef() {
		let tag = nested.shift();
		let id = void 0;
		let atts = [];
		let classList = [];
		let text = void 0;
		if (!tag) throw "Unexpected end of stream. Tag expected.";
		while (nested.length) if (match(".")) {
			let className = nested.shift();
			if (!className) throw "Unexpected end of stream. Class name expected.";
			classList.push(className);
		} else if (match("[")) atts = getAttributes();
		else {
			let token = matchStartsWith("#");
			if (token) id = token.substring(1);
			else {
				let token = matchStartsWith("{");
				if (token) text = stripStringDelimiters(token);
				else break;
			}
		}
		return {
			tag,
			id,
			atts,
			classList,
			innerText: text,
			child: parseDown()
		};
	}
	function parseDown() {
		if (match(">")) return parsePlus();
	}
	function getAttributes() {
		let tokens = [];
		while (nested.length) {
			let prop = nested.shift();
			if (prop == "]") break;
			tokens.push(prop);
		}
		let attDefs = [];
		while (tokens.length) {
			let name = tokens.shift();
			if (name[0] === ",") throw "Unexpected ',' - don't separate attributes with ','.";
			let eq = tokens.shift();
			let sub = "";
			if (eq === ".") {
				sub = tokens.shift() ?? "";
				eq = tokens.shift();
			}
			if (eq != "=") throw "Equal sign expected.";
			let value = tokens.shift();
			if (!value) throw "Value expected";
			if (value[0] === "\"") value = stripStringDelimiters(value);
			attDefs.push({
				name,
				sub,
				value
			});
			if (!tokens.length) break;
		}
		return attDefs;
	}
	function match(expected) {
		let next = nested.shift();
		if (next === expected) return true;
		if (next) nested.unshift(next);
		return false;
	}
	function matchStartsWith(expected) {
		let next = nested.shift();
		if (!next) return void 0;
		if (next.startsWith(expected)) return next;
		if (next) nested.unshift(next);
	}
	function stripStringDelimiters(text) {
		if (text[0] === "'" || text[0] === "\"" || text[0] === "{") return text.substring(1, text.length - 1);
		return text;
	}
	function createElement(parent, def, index, onIndex, hook) {
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
	function buildElement(parent, el, index, onIndex, hook) {
		if ("tag" in el) {
			let created = createElement(parent, el, index, onIndex, hook);
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
	//#endregion
	//#region typescript/def.ts
	const JSON_URL = "https://europe-west1-ebo-tain.cloudfunctions.net/json";
	const JSON_SINCE_URL = "https://europe-west1-ebo-tain.cloudfunctions.net/json-since";
	const GLOBAL_SETTINGS_FILENAME = "gringo_global_settings.json";
	const KEY_LAST_FETCHED_METAS = "gringo.lastFetchedMetas";
	const KEY_CLOUD_METAS_FOLDER = "gringo/pr/meta/";
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
	let defaultGlobalSettings = { projects: [] };
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
	//#endregion
	//#region typescript/pageObserver.ts
	var PartialUrlPageFilter = class {
		constructor(partialUrl) {
			this.partialUrl = partialUrl;
		}
		match() {
			return window.location.href.includes(this.partialUrl);
		}
	};
	var BaseObserver = class {
		constructor(onPageChangedCallback, pageFilter, onMutationCallback, trackModal = false, onPageRefreshedCallback) {
			this.isPageMatching = () => this.pageFilter.match();
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
			this.observer.observe(element, {
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
	//#endregion
	//#region typescript/tokenScanner.ts
	var ScannerElse = class {
		constructor(scannerIf) {
			this.scannerIf = scannerIf;
		}
		not(callback) {
			if (!this.scannerIf.yes) callback?.(this.scannerIf.scanner);
			return this.scannerIf.scanner;
		}
	};
	var ScannerIf = class {
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
		constructor() {
			this.lastText = "";
		}
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
	async function fetchPr(prId) {
		let chain = new FetchChain();
		await chain.fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false");
		let userInfo = chain.getJson();
		if (!userInfo) console.error("gringo: could not get userInfo.");
		await chain.fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/${prId}`);
		return chain.getJson();
	}
	//#endregion
	//#region typescript/aanvragen/observer.ts
	var AanvragenObserver = class extends PartialUrlObserver {
		constructor() {
			super("request-info-list/requisition", onMutation$1, false, onPageRefreshed$2);
		}
		isPageReallyLoaded() {
			return isPageProbablyLoaded$1();
		}
	};
	var observer_default$1 = new AanvragenObserver();
	function onPageRefreshed$2() {
		gringo("page Aanvragen refreshed xxx.");
		checkDecorations();
	}
	function isPageProbablyLoaded$1() {
		return !!getPagination();
	}
	function onMutation$1(mutation) {
		checkDecorations();
		return false;
	}
	function checkAndSetListPageDecorated(el) {
		let input = el;
		let isDecorated = el.dataset.gringoCurrentPage == input.value;
		el.dataset.gringoCurrentPage = input.value;
		return isDecorated;
	}
	function checkDecorations() {
		checkAndSetDecoration("filters", document.querySelector(".request-search-panel"), decorateSearchPanel);
		checkAndSetDecoration("listPage", getListTabDecoratedElement(), decorateRequestList, checkAndSetListPageDecorated);
	}
	function getPagination() {
		let paginationElement = document.querySelector("fd-pagination");
		if (!paginationElement) return null;
		let currentPageElement = paginationElement.querySelector("input");
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
	function checkAndSetDecoration(key, el, decorator, customCheckAndSet) {
		if (!el) return;
		if (customCheckAndSet) {
			if (!customCheckAndSet(el)) decorator();
			return;
		}
		if (el.dataset.gringoDecorated != "true") {
			el.dataset.gringoDecorated = "true";
			decorator();
		}
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
			gringo("Todo: update local cache and UI");
			await saveMetasLocal(changedFiles.map((f) => f.data));
			requests.forEach(decoratePr);
			await applyFilters(requests);
		});
		let button = emmet.appendChild(document.body, `
        div#gringo-tags-popover[popover=""]> (
            (div.flexRow>button.closePopup.naked{x})+
            div.popoverContainer{Container...}
        )        
    `).first.querySelector("button.closePopup");
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
	function decorateSearchPanel() {
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
		defaultTags.sort((a, b) => a.order - b.order).forEach((tagDef) => {
			createTagFilterRow(tbody, tagDef);
		});
		updateTagsFilters(getTagsFilters());
		let btnTestFetch = emmet.appendChild(tagsCollapse, `div>button#btnTestFetch{TEST Fetch last clicked}`).last;
		btnTestFetch.onclick = async (ev) => {
			if (globalLastRequestTagsClicked) await fetchFullRequest(globalLastRequestTagsClicked.id);
		};
		let btnTestRequestList = emmet.appendChild(tagsCollapse, `div>button#btnTestRequestList{TEST Fetch all}`).last;
		btnTestRequestList.onclick = async (ev) => {
			await fetchRequestList();
		};
		let btnTestRequestListAndDetails = emmet.appendChild(tagsCollapse, `div>button#btnTestRequestListAndDetails{TEST Fetch all with details}`).last;
		btnTestRequestListAndDetails.onclick = async (ev) => {
			await fetchRequestListAndDetails();
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
		updatePrLine(request, meta);
	}
	const defaultTags = [
		{
			name: "BB>",
			description: "Bestelbon verzonden",
			color: "",
			bkgColor: "orange",
			order: 0
		},
		{
			name: "✔",
			description: "Bestelling ontvangen",
			color: "green",
			bkgColor: "",
			order: 100
		},
		{
			name: "MW",
			description: "",
			color: "",
			bkgColor: "",
			order: 300
		},
		{
			name: "BK",
			description: "",
			color: "",
			bkgColor: "",
			order: 301
		},
		{
			name: "brol",
			description: "",
			color: "",
			bkgColor: "",
			order: 330
		},
		{
			name: "Zever",
			description: "",
			color: "blue",
			bkgColor: "",
			order: 390
		},
		{
			name: "En",
			description: "",
			color: "blue",
			bkgColor: "",
			order: 400
		},
		{
			name: "Nog",
			description: "",
			color: "blue",
			bkgColor: "",
			order: 500
		},
		{
			name: "Veel",
			description: "",
			color: "blue",
			bkgColor: "",
			order: 600
		},
		{
			name: "Langerx",
			description: "",
			color: "blue",
			bkgColor: "",
			order: 700
		}
	];
	const defaultTagsMap = new Map(defaultTags.map((t) => [t.name, t]));
	function getTagsFilters() {
		let json = localStorage.getItem("gringo.tagsFilters");
		if (!json) return [];
		return JSON.parse(json);
	}
	function saveTagsFilters(tagsFilters) {
		localStorage.setItem("gringo.tagsFilters", JSON.stringify(tagsFilters));
	}
	function updatePrLine(request, meta) {
		let reqDiv = document.getElementById("request-" + request.id);
		if (!reqDiv) return;
		let tagsContainer = reqDiv.querySelector(".tagsContainer");
		if (!tagsContainer) return;
		tagsContainer.innerHTML = "";
		meta.tags.map((tag) => {
			return defaultTagsMap.get(tag);
		}).filter((t) => !!t).sort((a, b) => a.order - b.order).forEach((tagDef) => {
			let tagSpan = emmet.appendChild(tagsContainer, `
                span    
            `).first;
			paintTag(tagSpan, tagDef, true);
		});
		let orphans = meta.tags.filter((tag) => !defaultTags.find((tagDef) => tagDef.name == tag));
		if (orphans.length > 0) emmet.appendChild(tagsContainer, orphans.map((tag) => `span.gringoTag{${tag}}`).join("+"));
		let select = reqDiv.querySelector("div.projectWrapper select");
		if (meta.project) select.value = meta.project;
	}
	function paintTag(tagElement, tagDef, selected) {
		tagElement.innerText = tagDef.name;
		tagElement.classList.add("gringoTag");
		tagElement.style.color = tagDef.color != "" ? tagDef.color : "inherit";
		tagElement.style.backgroundColor = tagDef.bkgColor != "" ? tagDef.bkgColor : "inherit";
		tagElement.title = tagDef.description;
		tagElement.classList.toggle("selected", selected);
	}
	async function fetchRequestList() {
		let chain = new FetchChain();
		await chain.fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false");
		let userInfo = chain.getJson();
		if (!userInfo) console.error("gringo: could not get userInfo.");
		await chain.post(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/getYourRequestsWithTabSupport?yourRequestsTab=requisition&yourRequestType=all&browserRequestId=newYourRequests1779060906435`, {
			"searchFilters": {
				"LastUpdatedFromDate": "2026-02-17 23:00:00 GMT",
				"LastUpdatedToDate": "2026-05-18 21:59:59 GMT"
			},
			"requestTypeFilter": "all",
			"orderByField": "daterequested",
			"ascendingOrder": false
		});
		let requestList = await chain.getJson();
		gringo(requestList);
		return requestList;
	}
	async function fetchRequestListAndDetails() {
		let promises = (await fetchRequestList()).requestList.map((r) => {
			let requestId = r.id;
			debugger;
			return fetchFullRequest(requestId);
		});
		let detailsList = await Promise.all(promises);
		debugger;
		return detailsList;
	}
	let globalLastRequestTagsClicked;
	async function fetchFullRequest(prId) {
		let pr = await fetchPr(prId);
		let prTitle = pr.title.value;
		let prStatus = pr.status;
		gringo(pr);
		for (let lineItem of pr.lineItems) {
			let accounting = lineItem.accounting;
			let rekening = "";
			if (accounting.fields) {
				for (let field of accounting.fields) if (field.name == "GeneralLedger") rekening = field.value;
			}
			let price = lineItem.quantity.value;
			let orderId = lineItem.orderID ?? "-";
			gringo(`${pr.reqId}/${orderId} : ${prTitle} : ${prStatus} : [${rekening}] : ${price}`);
		}
		return pr;
	}
	async function decoratePrWithMeta(request, meta) {
		let reqDiv = document.getElementById("request-" + request.id);
		if (!reqDiv) return;
		let divStatusContainer = reqDiv.querySelector("div.item-status-container");
		if (!divStatusContainer) return;
		divStatusContainer = divStatusContainer.parentElement;
		let metaWrapper = emmet.appendChild(divStatusContainer, `
        div.metaWrapper> (
            div.tagsWrapper.flexRow>(
                (button.naked.tagButton
                    >li.far.fa-circle-down)+
                div.tagsContainer
            )
        )
    `).first;
		let button = metaWrapper.querySelector("button.tagButton");
		button.onclick = (ev) => {
			onTagButtonClick(request, meta, button);
		};
		emmet.appendChild(metaWrapper, `
        div.projectWrapper.flexRow>(
            select
        )    
    `).first;
		let select = divStatusContainer.querySelector("select");
		let options = ["--selecteer--", ...(await getGlobalSettingsCached()).projects];
		for (let option of options) {
			let optionEl = document.createElement("option");
			optionEl.textContent = option;
			optionEl.value = option;
			select.appendChild(optionEl);
		}
		select.onchange = async (ev) => {
			await onSelectProjectClick(request, meta, select);
		};
		metaWrapper.onmousedown = (ev) => {
			ev.stopPropagation();
		};
		metaWrapper.onmouseup = (ev) => {
			ev.stopPropagation();
		};
		metaWrapper.onclick = (ev) => {
			ev.stopPropagation();
		};
	}
	async function onSelectProjectClick(request, meta, select) {
		meta.project = select.value;
		await saveMeta(meta.prId, meta, "localStorage and cloud");
	}
	function onTagButtonClick(request, meta, button) {
		let popover = document.getElementById("gringo-tags-popover");
		if (!popover) return;
		gringo("popover");
		popover.togglePopover({ source: button });
		let container = popover.querySelector(".popoverContainer");
		container.classList.add("tagList");
		container.innerHTML = "";
		globalLastRequestTagsClicked = request;
		defaultTags.sort((a, b) => a.order - b.order).forEach((tagDef) => {
			let tagButton = emmet.appendChild(container, `
                    button.naked.gringoTag{${tagDef.name}}
                `).first;
			paintTag(tagButton, tagDef, meta.tags.includes(tagDef.name));
			tagButton.onclick = async (ev) => {
				tagButton.classList.toggle("selected");
				let selected = tagButton.classList.contains("selected");
				gringo(`clicked ${tagDef.name} for ${request.id}(meta:${meta.prId})`);
				if (selected) meta.tags.push(tagDef.name);
				else meta.tags = meta.tags.filter((t) => t != tagDef.name);
				meta.prId = request.id;
				await saveMeta(request.id, meta, "localStorage and cloud");
				updatePrLine(request, meta);
			};
		});
	}
	async function saveMeta(prId, meta, what) {
		if (what == "localStorage and cloud") await cloud.json.upload(KEY_CLOUD_METAS_FOLDER + prId, meta);
		await saveMetaLocal(meta);
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
	//#endregion
	//#region typescript/aanvraag/observer.ts
	var AanvraagObserver = class extends PartialUrlObserver {
		constructor() {
			super("viewRequisition", onMutation, false, onPageRefreshed$1);
		}
		isPageReallyLoaded() {
			return isPageProbablyLoaded();
		}
	};
	var observer_default = new AanvraagObserver();
	function onPageRefreshed$1() {
		gringo("page Aanvraag refreshed.");
		decoratePage();
	}
	function isPageProbablyLoaded() {
		return true;
	}
	function onMutation(mutation) {
		decoratePage().then(() => {});
		return false;
	}
	let pr = null;
	async function decoratePage() {
		gringo("Decorating aanvraag page...");
		let sectionMain = document.querySelector(`section[role="main"]`);
		if (!sectionMain) return;
		if (getAndSetDecorated(sectionMain)) return;
		let prId = location.pathname.replace("/gb/viewRequisition/", "");
		gringo(prId);
		pr = await fetchPr(prId);
		gringo(pr);
		for (let item of pr.lineItems) {
			let commodityCodeField = item.advanced.fields?.find((f) => f.id.endsWith("pAtHCommonCommodityCode"));
			gringo(commodityCodeField);
			if (!commodityCodeField) continue;
			let commodityCode = commodityCodeField.uniqueName;
			gringo(commodityCode);
		}
		gringo(`Items to decorate: ${[...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)].length}`);
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
			registerObserver(observer_default$1);
			registerObserver(observer_default);
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