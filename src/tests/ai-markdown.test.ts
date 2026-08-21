/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, parseResponse, truncateAtWord } from '../../renderer/ai-markdown';
import { modelHint } from '../../renderer/ai-providers';

describe('a reply is cut into text and code', () => {
  test('a fenced block becomes a code part with its language', () => {
    const parts = parseResponse('before\n```dsmx\nx = 3\n```\nafter');
    assert.deepEqual(parts, [
      { type: 'text', content: 'before' },
      { type: 'code', content: 'x = 3', lang: 'dsmx' },
      { type: 'text', content: 'after' },
    ]);
  });

  test('a fence with no language reads as the DSL', () => {
    const [part] = parseResponse('```\nx = 3\n```');
    assert.deepEqual(part, { type: 'code', content: 'x = 3', lang: 'dsmx' });
  });

  test('two fences both come through', () => {
    const kinds = parseResponse('```\na\n```\nmid\n```\nb\n```').map(p => p.type);
    assert.deepEqual(kinds, ['code', 'text', 'code']);
  });

  test('a reply with no fence is one text part', () => {
    assert.deepEqual(parseResponse('  hello  '), [{ type: 'text', content: 'hello' }]);
  });

  test('nothing at all gives no parts', () => {
    assert.deepEqual(parseResponse(''), []);
  });
});

describe('a chat title is kept short', () => {
  test('quotes, trailing stops and long runs of space go', () => {
    assert.equal(cleanTitle('"a   plot of  x".'), 'a plot of x');
  });

  test('more than six words are cut to six', () => {
    assert.equal(cleanTitle('one two three four five six seven'), 'one two three four five six');
  });

  test('a short label is left alone', () => {
    assert.equal(truncateAtWord('short'), 'short');
  });

  test('a long label is cut at a word', () => {
    const out = truncateAtWord('the quick brown fox jumps over the lazy dog and keeps going');
    assert.ok(out.endsWith('…'));
    assert.ok(out.length <= 41);
    assert.equal(out.includes('jump…'), false);
  });
});

describe('an error tells the user what to change', () => {
  test('a model the provider does not have names the provider chip', () => {
    const hint = modelHint('404 model_not_found', 'gpt-5.3-mini');
    assert.ok(hint?.includes('gpt-5.3-mini'));
    assert.ok(hint?.includes('provider chip'));
  });

  test('a refused key asks for a key, not a model', () => {
    const hint = modelHint('401 Unauthorized', 'gpt-5.3-mini');
    assert.ok(hint?.includes('key'));
    assert.equal(hint?.includes('pick another model'), false);
  });

  test('an error nothing knows adds no hint', () => {
    assert.equal(modelHint('the network went away', 'gpt-5.3-mini'), null);
  });
});
