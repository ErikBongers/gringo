import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {Cursor} from "./cursor.ts";

describe('Testing tokenizer', () => {
    test('test cursor', () => {
        let cursor = new Cursor("12.34");
        let c = cursor.next();
        assert.equal(c, "1");
    });
});