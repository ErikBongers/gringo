// noinspection DuplicatedCode

import * as assert from "node:assert";
import {describe, test} from 'node:test';
import {Cursor} from "./cursor";
import {getText, Token, Tokenizer} from "./tokenizer";
import {PeekingTokenizer} from "./peekingTokenizer";
import {ERR_EXPECTED_CLOSE_PAREN, Parser, ParserError, ParseResult} from "./parser";

describe('Testing tokenizer', () => {
    test('test cursor', () => {
        let cursor = new Cursor("1.2");
        let c = cursor.next();
        assert.equal(c, "1");
        c = cursor.next();
        assert.equal(c, ".");
        c = cursor.next();
        assert.equal(c, "2");
        c = cursor.next();
        assert.equal(c, "");
    });

    test('test Tokenizer', () => {
        let tok = new Tokenizer("(123.4+2,3/3.4*4.5)+9.8,7.6-1*.01");
        let token: Token | null;
        token = tok.next(); assert.equal(getText(token!), "(");
        token = tok.next(); assert.equal(getText(token!), "123.4");
        token = tok.next(); assert.equal(getText(token!), "+");
        token = tok.next(); assert.equal(getText(token!), "2,3");
        token = tok.next(); assert.equal(getText(token!), "/");
        token = tok.next(); assert.equal(getText(token!), "3.4");
        token = tok.next(); assert.equal(getText(token!), "*");
        token = tok.next(); assert.equal(getText(token!), "4.5");
        token = tok.next(); assert.equal(getText(token!), ")");
        token = tok.next(); assert.equal(getText(token!), "+");
        token = tok.next(); assert.equal(getText(token!), "9.8,7.6");
        token = tok.next(); assert.equal(getText(token!), "-");
        token = tok.next(); assert.equal(getText(token!), "1");
        token = tok.next(); assert.equal(getText(token!), "*");
        token = tok.next(); assert.equal(getText(token!), ".01");
    });

    test('test PeekingTokenizer', () => {
        let tok = new PeekingTokenizer("1+2+3");
        let token: Token | null;
        token = tok.peek(); assert.equal(getText(token!), "1");
        token = tok.next(); assert.equal(getText(token!), "1");
        token = tok.peek(); assert.equal(getText(token!), "+");
        token = tok.peek(); assert.equal(getText(token!), "+");
        token = tok.next(); assert.equal(getText(token!), "+");
    });

    test('white space', () => {
        let tok = new PeekingTokenizer("1 + 2");
        let token: Token | null;
        token = tok.next(); assert.equal(getText(token!), "1");
        token = tok.next(); assert.equal(getText(token!), "+");
        token = tok.next(); assert.equal(getText(token!), "2");
        tok = new PeekingTokenizer(` 1   +  
          2 `);
        token = tok.next(); assert.equal(getText(token!), "1");
        token = tok.next(); assert.equal(getText(token!), "+");
        token = tok.next(); assert.equal(getText(token!), "2");
    });

});

describe('Testing Parser', () => {
    test('numbers', () => {
        let parser = new Parser("123");
        let res: ParseResult;
        res = parser.parse(); assertResult(res, 123, []);
        parser = new Parser("€123");
        res = parser.parse(); assertResult(res, 123, []);
        parser = new Parser("€ 123");
        res = parser.parse(); assertResult(res, 123, []);
        //point as decimal:
        parser = new Parser("123.4");
        res = parser.parse(); assertResult(res, 123.4, []);
        parser = new Parser("1.23.4"); //todo: should give warning of multiple decimal separators
        res = parser.parse(); assertResult(res, 123.4, []);
        parser = new Parser("1,23.4");
        res = parser.parse(); assertResult(res, 123.4, []);
        parser = new Parser("1,2,3.4");
        res = parser.parse(); assertResult(res, 123.4, []);
        // comma as decimal:
        parser = new Parser("123,4");
        res = parser.parse(); assertResult(res, 123.4, []);
        parser = new Parser("1,23,4"); //todo: should give warning of multiple decimal separators
        res = parser.parse(); assertResult(res, 123.4, []);
        parser = new Parser("1.23,4");
        res = parser.parse(); assertResult(res, 123.4, []);
        parser = new Parser("1.2.3,4");
        res = parser.parse(); assertResult(res, 123.4, []);
    });

    test('parens', () => {
        let parser = new Parser("(123)");
        let res: ParseResult;
        res = parser.parse(); assertResult(res, 123, []);
        parser = new Parser("(123 1)");
        res = parser.parse(); assertResult(res, 123, [ERR_EXPECTED_CLOSE_PAREN]);
        parser = new Parser("(123");
        res = parser.parse(); assertResult(res, 123, [ERR_EXPECTED_CLOSE_PAREN]);
    });

    test('terms', () => {
        let parser = new Parser("12*3");
        let res: ParseResult;
        res = parser.parse(); assertResult(res, 36, []);
        parser = new Parser("(12)*(3)");
        res = parser.parse(); assertResult(res, 36, []);
    });

    test('expr', () => {
        let parser = new Parser("12+3");
        let res: ParseResult;
        res = parser.parse(); assertResult(res, 15, []);
        parser = new Parser("(12)-(3)");
        res = parser.parse(); assertResult(res, 9, []);
        parser = new Parser("1-3*2+4");
        res = parser.parse(); assertResult(res, -1, []);
    });
});

function assertResult(res: ParseResult, expected: number, errors: ParserError[]) {
    assert.equal(res.result, expected);
    if(errors.length != res.errors.length)
        assert.fail("Errors do not match.");
}