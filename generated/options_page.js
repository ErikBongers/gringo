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
	const GLOBAL_SETTINGS_FILENAME = "gringo/gringo_global_settings.json";
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
	function defineHtmlOptions() {
		defineHtmlOption("showDebug", "checked", "Show debug info in console.", "block3");
	}
	let htmlOptionDefs = /* @__PURE__ */ new Map();
	function defineHtmlOption(id, property, label, blockId) {
		htmlOptionDefs.set(id, {
			id,
			property,
			label,
			blockId
		});
	}
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
	async function saveGlobalSettings(globalSettings) {
		return cloud.json.upload(GLOBAL_SETTINGS_FILENAME, globalSettings);
	}
	async function fetchGlobalSettings() {
		return await cloud.json.fetch(GLOBAL_SETTINGS_FILENAME).catch((err) => {
			console.log(err);
			return defaultGlobalSettings;
		});
	}
	//#endregion
	//#region typescript/plugin_options/options_page.ts
	defineHtmlOptions();
	const saveOptionsFromGui = () => {
		let newOptions = { touched: Date.now() };
		for (let option of htmlOptionDefs.values()) newOptions[option.id] = document.getElementById(option.id)[option.property];
		chrome.storage.sync.set(newOptions, () => {
			const status = document.getElementById("status");
			status.textContent = "Opties bewaard.";
			setTimeout(() => {
				status.textContent = "";
			}, 750);
		});
	};
	async function saveGlobalsFromGui() {
		if (prompt("Zijdezeker? Tik dan GRINGO en klik Ok.") != "GRINGO") return;
		let projects = document.getElementById("txtProjects").value.split("\n").map((l) => l.trim()).filter((l) => l != "");
		let tags = document.getElementById("txtGlobalTags").value.split("\n").map((l) => l.trim()).filter((l) => l != "");
		let order = 0;
		await saveGlobalSettings({
			projects,
			tagDefs: tags.map((t) => {
				let values = t.split(",").map((t) => t.trim());
				let name = "";
				let description = "";
				let color = "";
				let bkgColor = "";
				if (values.length >= 1) name = values[0];
				if (values.length >= 2) description = values[1];
				if (values.length >= 3) color = values[2];
				if (values.length >= 4) bkgColor = values[3];
				return {
					name,
					description,
					color,
					bkgColor,
					order: order++
				};
			})
		});
	}
	async function restoreOptionsToGui() {
		let items = await chrome.storage.sync.get(null);
		Object.assign(options, items);
		for (const [key, value] of Object.entries(options)) {
			let optionDef = htmlOptionDefs.get(key);
			if (!optionDef) continue;
			document.getElementById(optionDef.id)[optionDef.property] = value;
		}
	}
	async function fillGlobalOptionsInGui() {
		let txtProjects = document.getElementById("txtProjects");
		let txtGlobalTags = document.getElementById("txtGlobalTags");
		setGlobalSetting(await fetchGlobalSettings());
		let globalSettings = await getGlobalSettingsCached();
		txtProjects.value = globalSettings.projects.join("\n");
		txtGlobalTags.value = globalSettings.tagDefs.map((tagDef) => {
			if (tagDef.bkgColor != "") return `${tagDef.name}, ${tagDef.description}, ${tagDef.color}, ${tagDef.bkgColor}`;
			else if (tagDef.color != "") return `${tagDef.name}, ${tagDef.description}, ${tagDef.color}`;
			else if (tagDef.description != "") return `${tagDef.name}, ${tagDef.description}`;
			else return tagDef.name;
		}).join("\n");
	}
	async function fillOptionsInGui() {
		for (let optiondDef of htmlOptionDefs.values()) {
			if (!optiondDef.blockId) continue;
			let block = document.getElementById(optiondDef.blockId);
			emmet.appendChild(block, `label>input#${optiondDef.id}[type="checkbox"]+{${optiondDef.label}}`);
		}
		await restoreOptionsToGui();
		await fillGlobalOptionsInGui();
	}
	document.addEventListener("DOMContentLoaded", fillOptionsInGui);
	document.getElementById("save").addEventListener("click", saveOptionsFromGui);
	document.getElementById("btnSaveGlobal").addEventListener("click", saveGlobalsFromGui);
	//#endregion
})();

//# sourceMappingURL=options_page.js.map