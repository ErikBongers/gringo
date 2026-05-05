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
			if (!value) throw "Value expected.";
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
	const GLOBAL_SETTINGS_FILENAME = "gringo_global_settings.json";
	//#endregion
	//#region typescript/cloud.ts
	let cloud = { json: {
		fetch: fetchJson,
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
	//#endregion
	//#region typescript/plugin_options/options.ts
	const options = { showDebug: false };
	let globalSettings = { globalHide: false };
	function getGlobalSettings() {
		return globalSettings;
	}
	function setGlobalSetting(settings) {
		globalSettings = settings;
	}
	async function fetchGlobalSettings(defaultSettings) {
		return await cloud.json.fetch(GLOBAL_SETTINGS_FILENAME).catch((err) => {
			console.log(err);
			return defaultSettings;
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
	function equals(g1, g2) {
		return g1.globalHide === g2.globalHide;
	}
	async function getOptions() {
		let items = await chrome.storage.sync.get(null);
		Object.assign(options, items);
		setGlobalSetting(await fetchGlobalSettings(getGlobalSettings()));
	}
	function tryUntilThen(func, then) {
		if (func()) then();
		else setTimeout(() => tryUntilThen(func, then), 100);
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
	//#region typescript/aanvragen/observer.ts
	var AanvragenObserver = class extends PartialUrlObserver {
		constructor() {
			super("request-info-list/requisition", onMutation, false, onPageRefreshed$1);
		}
		isPageReallyLoaded() {
			return true;
		}
	};
	var observer_default = new AanvragenObserver();
	function onPageRefreshed$1() {
		gringo("page Aanvragen refreshed xxx.");
		decorateAllPRs();
	}
	function onMutation(mutation) {
		gringo("MUTATION!!!");
		if (document.querySelector("fd-pagination")) {
			decorateAllPRs();
			return true;
		}
		return false;
	}
	function gringo(...args) {
		console.log("gringo", ...args);
	}
	function decorateAllPRs() {
		[...document.querySelectorAll("request-info-item")].map(scrapeInfoItem).forEach(decoratePr);
	}
	function scrapeInfoItem(requestDiv) {
		let id = requestDiv.id.substring(8);
		let divOrders = requestDiv.querySelector(".item-orders");
		let orderAnchors = [];
		if (divOrders) orderAnchors = [...divOrders.querySelectorAll(".request-po-list-container ul > li a")];
		return {
			id,
			div: requestDiv,
			orderAnchors
		};
	}
	function decoratePr(request) {
		if (request.div.dataset.gringo == "decorated") return;
		request.div.dataset.gringo = "decorated";
		request.orderAnchors.forEach((a) => {
			let button = emmet.insertAfter(a, `
            button.copyAnchorText.naked
                >li.far.fa-copy 
            `).first;
			button.onmousedown = async (ev) => {
				await navigator.clipboard.writeText(a.innerText);
				ev.stopPropagation();
				ev.preventDefault();
			};
			button.onmouseup = (ev) => {
				ev.stopPropagation();
				ev.preventDefault();
			};
			button.onclick = (ev) => {
				ev.stopPropagation();
				ev.preventDefault();
			};
		});
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
				checkGlobalSettings();
				onPageChanged();
			});
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
	let lastCheckTime = Date.now();
	function checkGlobalSettings() {
		if (Date.now() > lastCheckTime + 10 * 1e3) {
			lastCheckTime = Date.now();
			console.log("Re-fetching global settings.");
			fetchGlobalSettings(getGlobalSettings()).then((r) => {
				if (!equals(getGlobalSettings(), r)) {
					setGlobalSetting(r);
					onSettingsChanged();
				}
			});
		}
	}
	function onSettingsChanged() {
		console.log("on settings changed.");
		for (let observer of settingsObservers) observer();
	}
	function onPageChanged() {
		if (getGlobalSettings().globalHide) return;
		for (let observer of observers) observer.onPageChanged();
	}
	function onPageRefreshed() {
		if (getGlobalSettings().globalHide) return;
		for (let observer of observers) observer.onPageRefreshed();
	}
	//#endregion
})();

//# sourceMappingURL=bundle.js.map