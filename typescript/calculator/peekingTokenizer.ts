import {Token, Tokenizer, TokenType} from "./tokenizer";

export class PeekingTokenizer {
    private tokenizer: Tokenizer;
    private peekedToken: Token | null = null;

    constructor(text: string) {
        this.tokenizer = new Tokenizer(text);
    }

    peek() {
        if(this.peekedToken)
            return this.peekedToken;
        let cursor = this.tokenizer.cloneCursor();
        this.peekedToken = this.tokenizer.next();
        this.tokenizer.setCursor(cursor);
        return this.peekedToken;
    }

    //proxy forward other functions
    next() {
        this.peekedToken = null;
        return this.tokenizer.next();
    }

    getCursor() {
        return this.tokenizer.cloneCursor();
    }

    public match(tokenType: TokenType) {
        let token = this.peek();
        if(token?.type == tokenType) {
            this.next();
            return token;
        }
        return null;
    }

}