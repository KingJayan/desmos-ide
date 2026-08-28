/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { parseLayout, DEFAULT_LAYOUT, DIVIDERS } = await import('../../renderer/modules/layout-store');

describe('the remembered layout', () => {
  test('a first launch gets the defaults', () => {
    assert.deepEqual(parseLayout(null), { ...DEFAULT_LAYOUT, sizes: {} });
  });

  test('a broken file does not stop the window opening', () => {
    assert.deepEqual(parseLayout('{ not json').sizes, {});
    assert.deepEqual(parseLayout('[]').sizes, {});
    assert.equal(parseLayout('7').leftView, null);
  });

  test('every divider size survives a round trip', () => {
    const sizes = Object.fromEntries(DIVIDERS.map((name, i) => [name, 200 + i]));
    assert.deepEqual(parseLayout(JSON.stringify({ sizes })).sizes, sizes);
  });

  test('a size that is not a positive number is dropped, not applied', () => {
    for (const bad of [0, -40, 'wide', null, NaN]) {
      assert.deepEqual(parseLayout(JSON.stringify({ sizes: { editor: bad } })).sizes, {}, String(bad));
    }
  });

  test('a panel name the app does not have falls back', () => {
    assert.equal(parseLayout('{"leftView":"files"}').leftView, null);
    assert.equal(parseLayout('{"bottomTab":"console"}').bottomTab, 'problems');
    assert.equal(parseLayout('{"maximized":"ai"}').maximized, null);
  });

  test('the panels that were open are the panels that come back', () => {
    const state = parseLayout(JSON.stringify({
      leftView: 'git', aiOpen: true, bottomOpen: true, bottomTab: 'optimizer', maximized: 'graph',
    }));
    assert.equal(state.leftView, 'git');
    assert.equal(state.aiOpen, true);
    assert.equal(state.bottomOpen, true);
    assert.equal(state.bottomTab, 'optimizer');
    assert.equal(state.maximized, 'graph');
  });

  test('a missing flag is closed, not open', () => {
    const state = parseLayout('{}');
    assert.equal(state.aiOpen, false);
    assert.equal(state.bottomOpen, false);
  });
});
