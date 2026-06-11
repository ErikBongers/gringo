import {Tokenizer} from "./tokenizer";

export class PeekingTokenizer {
    private tokenizer: Tokenizer;

    constructor(tokenizer: Tokenizer) {
        this.tokenizer = tokenizer;
    }

    peek() {
        let cursor = this.tokenizer.getCursor();
        let token = this.tokenizer.next();
        this.tokenizer.setCursor(cursor);
        return token;
    }
}