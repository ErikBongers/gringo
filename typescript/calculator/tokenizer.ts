import {Cursor} from "./cursor";

// Tokenizes only arithmetic expressions.
// Allows both comma and dot as decimal points. When both are used, only the most right one is considered.

type TokenType = "UNKNOWN" | "NUMBER" | "(" | ")" | "." | "," | "EURO" | "DOLLAR";

export interface Token {
    type: TokenType;
    cursor: Cursor;
    pos: number;
    length: number;
}

export class Tokenizer {
    private readonly cursor: Cursor;

    constructor(text: string) {
        this.cursor = new Cursor(text);
    }

    next() {
        switch (this.cursor.peek()) {
            case "":
                return null;
            case "(":
            case ")":
                let token: Token = {
                    type: this.cursor.peek() as TokenType,
                    cursor: this.cursor,
                    pos: this.cursor.pos,
                    length: 1,
                };
                this.cursor.next();
                return token;
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
            case "9":
                return this.parseNumber();
            default:
                return {
                    type: "UNKNOWN",
                    cursor: this.cursor,
                    pos: this.cursor.pos,
                    length: 1,
                };
        }
    }

    private parseNumber() {
        let token: Token = {
            type: "NUMBER",
            cursor: this.cursor,
            pos: this.cursor.pos,
            length: 0,
        };
        while(this.cursor.current.match(/[0-9.,]/)) {
            token.length++;
            this.cursor.next();
        }
        return token;
    }

}