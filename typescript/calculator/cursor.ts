export class Cursor {
    private readonly text: string;
    private currentPos: number;
    private readonly length: number;

    constructor(text: string) {
        this.text = text;
        this.length = this.text.length;
        this.currentPos = -1;
    }

    eat(char: string) {
        if(this.currentPos >= this.length)
            return false;
        if(this.text[this.currentPos] == char) {
            this.currentPos++;
            return true;
        }
        return false;
    }

    get pos() {
        return this.currentPos;
    }

    get current() {
        if(this.currentPos >= this.length)
            return "";
        return this.text[this.currentPos];
    }

    next() {
        if(this.currentPos >= this.length)
            return "";
        this.currentPos++;
        return this.current;
    }

    peek() {
        if((this.currentPos+1) >= this.length)
            return "";
        return this.text[this.currentPos+1];
    }

}