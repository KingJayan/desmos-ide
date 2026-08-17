/// <reference types="node" />
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DesmosExpr } from '../compiler/codegen';

// DesmosGraph talks to the calculator the api gives it, so the test gives it one
// that records the writes, and drives requestAnimationFrame by hand
type Write = { kind: 'set'; ids: string[] } | { kind: 'remove'; id: string };

const writes: Write[] = [];
let frames: (() => void)[] = [];

const calc = {
  setExpression() {},
  setExpressions(list: Record<string, unknown>[]) {
    writes.push({ kind: 'set', ids: list.map(e => String(e['id'])) });
  },
  removeExpression({ id }: { id: string }) { writes.push({ kind: 'remove', id }); },
  updateSettings() {},
  getExpressions() { return []; },
  destroy() {},
};

const g = globalThis as unknown as Record<string, unknown>;
g['Desmos'] = { GraphingCalculator: () => calc };
g['requestAnimationFrame'] = (cb: () => void) => { frames.push(cb); return frames.length; };
g['cancelAnimationFrame'] = () => {};

const { DesmosGraph } = await import('../../renderer/desmos');

function runFrames(): void {
  for (let i = 0; i < 100 && frames.length; i++) {
    const queue = frames;
    frames = [];
    for (const cb of queue) cb();
  }
}

function exprs(count: number, from = 0): DesmosExpr[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'expression' as const,
    id: `e${from + i}`,
    latex: `y=${from + i}x`,
  }));
}

const setIds = () => writes.filter(w => w.kind === 'set').flatMap(w => w.ids);

describe('the graph batches big updates', () => {
  beforeEach(() => { writes.length = 0; frames = []; });

  test('a small edit goes out in one write, with no frame wait', () => {
    const graph = new DesmosGraph({} as HTMLElement);
    graph.update(exprs(3));
    assert.deepEqual(writes, [{ kind: 'set', ids: ['e0', 'e1', 'e2'] }]);
    assert.equal(frames.length, 0);
  });

  test('a large list is spread over frames and arrives whole', () => {
    const graph = new DesmosGraph({} as HTMLElement);
    graph.update(exprs(250));
    assert.equal(writes.length < 250, true);
    runFrames();
    assert.deepEqual(setIds(), exprs(250).map(e => e.id));
  });

  test('an expression still in the queue is not treated as drawn', () => {
    const graph = new DesmosGraph({} as HTMLElement);
    graph.update(exprs(250));
    // the same list again, before the queue drains
    graph.update(exprs(250));
    runFrames();
    const sent = setIds();
    assert.deepEqual([...new Set(sent)], exprs(250).map(e => e.id));
  });

  test('nothing is written twice when the list does not change', () => {
    const graph = new DesmosGraph({} as HTMLElement);
    graph.update(exprs(10));
    runFrames();
    writes.length = 0;
    graph.update(exprs(10));
    runFrames();
    assert.deepEqual(writes, []);
  });

  test('an expression dropped before it is flushed is never sent', () => {
    const graph = new DesmosGraph({} as HTMLElement);
    graph.update(exprs(250));
    graph.update(exprs(100));
    runFrames();
    assert.equal(setIds().includes('e200'), false);
    assert.deepEqual([...new Set(setIds())], exprs(100).map(e => e.id));
  });

  test('a removal reaches the calculator at once', () => {
    const graph = new DesmosGraph({} as HTMLElement);
    graph.update(exprs(3));
    writes.length = 0;
    graph.update(exprs(2));
    assert.deepEqual(writes, [{ kind: 'remove', id: 'e2' }]);
  });
});
