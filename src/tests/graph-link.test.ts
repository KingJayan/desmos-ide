/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GraphLink, idForLine, lineForId } from '../../renderer/graph-link';
import type { ExprSource } from '../index';
import { compile } from '../index';

const MAP: ExprSource[] = [
  { id: 'a', line: 1, col: 1 },
  { id: 'c', line: 3, col: 1 },
  { id: 'b', line: 7, col: 1 },
];

describe('looking up a line', () => {
  test('finds the source of an expression', () => {
    assert.equal(lineForId(MAP, 'c')?.line, 3);
    assert.equal(lineForId(MAP, 'nope'), null);
  });

  test('a cursor on the statement line finds it', () => {
    assert.equal(idForLine(MAP, 3), 'c');
  });

  test('a cursor inside a statement that spans lines still finds it', () => {
    assert.equal(idForLine(MAP, 5), 'c');
  });

  test('a cursor above every statement finds nothing', () => {
    assert.equal(idForLine([{ id: 'a', line: 4, col: 1 }], 2), null);
  });

  test('an empty map finds nothing', () => {
    assert.equal(idForLine([], 3), null);
  });
});

function harness(map: ExprSource[] = MAP) {
  const calls = { reveal: [] as number[], highlight: [] as (number | null)[], select: [] as (string | null)[] };
  const link = new GraphLink({
    sourceMap: () => map,
    revealLine: line => calls.reveal.push(line),
    highlightLine: line => calls.highlight.push(line),
    selectOnGraph: id => calls.select.push(id),
  });
  return { link, calls };
}

describe('following the graph selection', () => {
  test('reveals and highlights the line the expression came from', () => {
    const { link, calls } = harness();
    link.onGraphSelected('c');
    assert.deepEqual(calls.reveal, [3]);
    assert.deepEqual(calls.highlight, [3]);
  });

  test('does not send the selection back to the graph', () => {
    const { link, calls } = harness();
    link.onGraphSelected('c');
    assert.deepEqual(calls.select, []);
  });

  test('selecting the same expression twice does nothing the second time', () => {
    const { link, calls } = harness();
    link.onGraphSelected('c');
    link.onGraphSelected('c');
    assert.deepEqual(calls.reveal, [3]);
  });

  test('clearing the selection clears the highlight', () => {
    const { link, calls } = harness();
    link.onGraphSelected('c');
    link.onGraphSelected(null);
    assert.deepEqual(calls.highlight, [3, null]);
  });

  test('an expression the file did not produce moves nothing', () => {
    const { link, calls } = harness();
    link.onGraphSelected('made-in-the-graph');
    assert.deepEqual(calls.reveal, []);
    assert.deepEqual(calls.highlight, [null]);
  });
});

describe('following the cursor', () => {
  test('selects the matching expression on the graph', () => {
    const { link, calls } = harness();
    link.onCursorMoved(7);
    assert.deepEqual(calls.select, ['b']);
    assert.deepEqual(calls.highlight, [7]);
  });

  test('moving inside the same statement does not reselect', () => {
    const { link, calls } = harness();
    link.onCursorMoved(3);
    link.onCursorMoved(4);
    assert.deepEqual(calls.select, ['c']);
  });

  test('moving above every statement clears the graph selection', () => {
    const { link, calls } = harness([{ id: 'a', line: 4, col: 1 }]);
    link.onCursorMoved(4);
    link.onCursorMoved(1);
    assert.deepEqual(calls.select, ['a', null]);
    assert.deepEqual(calls.highlight, [4, null]);
  });

  test('a reset drops the link so the next move is seen again', () => {
    const { link, calls } = harness();
    link.onCursorMoved(3);
    link.reset();
    link.onCursorMoved(3);
    assert.deepEqual(calls.select, ['c', 'c']);
  });
});

describe('linked to a real compile', () => {
  const src = 'a = slider(1, 0, 10)\npoint p (0, 0)\nregion r = y > x';

  test('every graph expression jumps to the line that wrote it', () => {
    const r = compile(src);
    assert.equal(r.success, true);
    if (!r.success) return;

    for (const expr of r.state.expressions.list) {
      const at = lineForId(r.sourceMap, expr.id);
      assert.ok(at, `no source for ${expr.id}`);
      assert.ok(at!.line >= 1 && at!.line <= 3);
    }
  });

  test('the cursor on each line finds the expression on that line', () => {
    const r = compile(src);
    if (!r.success) return;
    assert.equal(idForLine(r.sourceMap, 1), 'a');
    assert.equal(idForLine(r.sourceMap, 2), 'p');
    assert.equal(idForLine(r.sourceMap, 3), 'r');
  });
});
