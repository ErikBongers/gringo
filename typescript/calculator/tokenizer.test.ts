import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {Cursor} from "./cursor.ts";

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
});