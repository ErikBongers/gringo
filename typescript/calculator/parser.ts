import {PeekingTokenizer} from "./peekingTokenizer";
import {getText} from "./tokenizer";

export interface ParseResult {
    result: number;
    errors: ParserError[];
}

export interface ParserError {
    error_type: "E" | "W",
    message: string
}
export const ERR_EXPECTED_CLOSE_PAREN: ParserError = {error_type: "E", message: "expected ')'"};

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

    parseExpression(): ParseResult {
        let term1 = this.parseTerm();
        while(true) {
            let operator = this.peekingTokenizer.peek();
            if (!operator)
                return term1;
            if (operator.type != "+" && operator.type != "-")
                return term1;
            this.peekingTokenizer.next(); //eat operator
            let term2 = this.parseTerm();
            if (operator.type == "+")
                term1 = {result: term1.result + term2.result, errors: term1.errors.concat(term2.errors)};
            else
                term1 = {result: term1.result - term2.result, errors: term1.errors.concat(term2.errors)};
        }
    }

    parseTerm(): ParseResult {
        let factor1= this.parseFactor();
        while (true) {
            let operator = this.peekingTokenizer.peek();
            if (!operator)
                return factor1;
            if (operator.type != "*" && operator.type != "/")
                return factor1;
            this.peekingTokenizer.next(); //eat operator
            let factor2 = this.parseFactor();
            if (operator.type == "*")
                factor1 = {result: factor1.result * factor2.result, errors: factor1.errors.concat(factor2.errors)};
            else
                factor1 = {result: factor1.result / factor2.result, errors: factor1.errors.concat(factor2.errors)};
        }
    }

    parseFactor(): ParseResult {
        if(this.peekingTokenizer.match("(")) {
            let res = this.parseExpression();
            let peeked = this.peekingTokenizer.peek();
            if(peeked?.type == ")")
                this.peekingTokenizer.next();
            else if(peeked != null)
                res.errors.push(ERR_EXPECTED_CLOSE_PAREN);
            //else: EOT is not an error (yet)
            return res;
        }
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