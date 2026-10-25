(function() {
	//#region libs/Emmeter/tokenizer/PeekingTokenizer.ts
	var PeekingTokenizer = class {
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
		getTo(endChar, allowEscape = false) {
			let start = this.currentPos + 1;
			let end = start;
			while (end < this.length && (this.text[end] != endChar || this.text[end - 1] == "\\")) end++;
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
			while (end < this.length && (this.text[end] == notChar || this.text[end - 1] == "\\")) end++;
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
			for (let i = 0; i < this.length; i++) if (this.text[i] == "\n") {
				if (loc.line > 1) {
					start = i + 1;
					loc.line--;
				} else {
					end = i;
					break;
				}
			}
			return this.text.substring(start, end);
		}
	};
	//#endregion
	//#region libs/Emmeter/tokenizer/indentTokenizer.ts
	function getText(token) {
		return token.cursor.getText(token.pos, token.length);
	}
	var IndentTokenizer = class IndentTokenizer {
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
	var Parser = class {
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
					count: parseInt(getText(mustBeNumber)),
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
			if (textToken) return { text: getText(textToken) };
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
					classList.push(getText(className));
					continue;
				}
				if (this.match("[")) {
					atts = this.parseAttributes(currentIndent);
					continue;
				}
				if (this.match("#")) {
					let idToken = this.tok.next();
					if (!idToken) this.throwAt("Unexpected end of stream. ID expected.", idToken);
					id = getText(idToken);
					continue;
				}
				let textToken = this.match("TEXT");
				if (textToken) {
					innerText = getText(textToken);
					continue;
				}
				break;
			}
			return {
				tag: getText(tag),
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
			let name = getText(nameToken);
			if (name[0] === ",") this.throwAt("Unexpected ',' - don't separate attributes with ','.", nameToken);
			let eq = this.tok.next();
			if (!eq) this.throwAt("Unexpected end of stream. '=' expected.", eq);
			let subToken;
			let sub = "";
			if (eq.type === ".") {
				subToken = this.tok.next();
				if (subToken) sub = getText(subToken);
				eq = this.tok.next();
			}
			if (eq?.type != "=") this.throwAt("Equal sign expected.", eq);
			let valueToken = this.tok.next();
			if (!valueToken) this.throwAt("Value expected", valueToken);
			if (valueToken.type != "STRING" && valueToken.type != "NUMBER") this.throwAt(`Value should be STRING or NUMBER. Found ${valueToken.type}.`, valueToken);
			let value = getText(valueToken);
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
		return createOnTempParent(new PeekingTokenizer(new FilteredTokenizer(new IndentTokenizer(text), (t) => t.type != "INDENT")), onIndex, hook);
	}
	function createElement_indent(text, onIndex, hook) {
		return createOnTempParent(new PeekingTokenizer(new IndentTokenizer(text)), onIndex, hook);
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
		for (let child of children) if (!first) {
			if (child.nodeType === Node.TEXT_NODE) first = insertPos = insertAdjacentText(target, position, child.wholeText);
			else first = insertPos = target.insertAdjacentElement(position, child);
		} else if (child.nodeType === Node.TEXT_NODE) insertPos = insertPos.parentElement.insertBefore(document.createTextNode(child.wholeText), insertPos.nextSibling);
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
		return new PeekingTokenizer(new FilteredTokenizer(new IndentTokenizer(text), (t) => t.type != "INDENT"));
	}
	function createIndentTokenizer(text) {
		return new PeekingTokenizer(new IndentTokenizer(text));
	}
	function parseAndBuild(tok, root, onIndex, hook) {
		buildElement(root, new Parser(tok).parse(), 1, onIndex, hook);
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
	//#region typescript/totalsTab.ts
	main();
	function main() {
		emmet.indent.appendChild(document.body, `
        span{generated!}
    `);
	}
	//#endregion
})();

//# sourceMappingURL=totalsTab.js.map