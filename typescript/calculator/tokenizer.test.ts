// noinspection DuplicatedCode

import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {Cursor} from "./cursor";
import {getText, Token, Tokenizer} from "./tokenizer";
import {PeekingTokenizer} from "./peekingTokenizer";

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
        tok = new PeekingTokenizer(" 1 + 2 ");
        token = tok.next(); assert.equal(getText(token!), "1");
        token = tok.next(); assert.equal(getText(token!), "+");
        token = tok.next(); assert.equal(getText(token!), "2");
    });

});