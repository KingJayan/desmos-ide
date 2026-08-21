/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { GraphOnly } = await import('../../renderer/graph-only');

describe('what the graph holds but the file cannot', () => {
  test('nothing refused counts for nothing, and shows nothing', () => {
    const held = new GraphOnly();
    held.record([], ['e1']);
    assert.equal(held.count, 0);
    assert.equal(held.label(), '');
    assert.equal(held.title(), '');
  });

  test('a refused expression is counted once, however often it is edited', () => {
    const held = new GraphOnly();
    held.record(['e1'], ['e1']);
    held.record(['e1'], ['e1']);
    assert.equal(held.count, 1);
    assert.equal(held.label(), '1 graph-only');
    assert.ok(held.title().startsWith('1 expression has no DSL form'));
  });

  test('an expression that writes back stops counting', () => {
    const held = new GraphOnly();
    held.record(['e1'], ['e1']);
    held.record([], ['e1']);
    assert.equal(held.count, 0);
  });

  test('an id nothing looked at is left alone', () => {
    const held = new GraphOnly();
    held.record(['e1'], ['e1']);
    held.record(['e2'], ['e2']);
    assert.equal(held.count, 2);
    assert.equal(held.label(), '2 graph-only');
    assert.ok(held.title().includes('they are not in the saved file'));
  });

  test('an export clears the count', () => {
    const held = new GraphOnly();
    held.record(['e1', 'e2']);
    held.clear();
    assert.equal(held.count, 0);
  });
});
