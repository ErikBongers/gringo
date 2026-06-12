import {PeekingTokenizer} from "./peekingTokenizer";
import {getText, Token} from "./tokenizer";

export interface ParseResult {
    result: number;
    errors: string[];
}

export class Parser {
    private readonly peekingTokenizer: PeekingTokenizer;

    constructor(text: string) {
        this.peekingTokenizer = new PeekingTokenizer(text);
    }

    // expression: term (('+' | '-') term)*
    // term: factor (('*' | '/') factor)*
    // factor: price | '(' expression ')'
    // price: currency? number
    // number: [0-9]+ (decimal_point [0-9]+)? //note that number uses the most right decimal point and ignores the others. So, this EBNF is not entirely correct.
    // decimal_point: '.' | ','
    // currency: '$' | '€'

    //parse gracefully, but include warnings/errors in result

    parse() {
        return this.parseExpression();
    }

    parseExpression() {
        return this.parseTerm();
    }

    parseTerm() {
        return this.parseFactor();
    }

    parseFactor() {
        return this.parseCurrency();
    }

    parseCurrency() {
        let peeked = this.peekingTokenizer.peek();
        if(!peeked)
            return {result: 0, errors: []};
        if(peeked.type == "€")
            this.peekingTokenizer.next();//todo: ignore for now, but currencies should not be mixed.
        return this.parseNumber();
    }

    parseNumber(): ParseResult {
        let token = this.peekingTokenizer.next();
        if(!token)
            return {result: 0, errors: []};

        let text = getText(token);
        text = text.trim();
        if(text.startsWith("€"))
            text = text.substring(1);
        let decimalPoint: string;
        let thousandSeparator: string;
        let lastCommaIndex = text.lastIndexOf(",");
        let lastPointIndex = text.lastIndexOf(".");
        if(lastPointIndex > lastCommaIndex) {
            decimalPoint = ".";
            thousandSeparator = ",";
        } else {
            decimalPoint = ",";
            thousandSeparator = ".";
        }
        text = text.replaceAll(thousandSeparator, "");
        let slices = text.split(decimalPoint);
        //merge slices again, but put a decimal point in between the last 2 slices.
        if(slices.length > 1) {
            let decimals = slices.pop();
            text = slices.join("") + "." + decimals;
        }
        return {result: parseFloat(text), errors: []};
    }
}