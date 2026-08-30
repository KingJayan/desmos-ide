/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../index';

function mapOf(src: string) {
  const r = compile(src);
  assert.equal(r.success, true, JSON.stringify(r));
  if (!r.success) throw new Error('unreachable');
  return r;
}

describe('expression source map', () => {
  test('maps every graph expression back to a line', () => {
    const r = mapOf('a = 1\npoint p = (0, 0)\nregion s = y > x');
    const ids = r.state.expressions.list.map(e => e.id);
    const mapped = new Set(r.sourceMap.map(e => e.id));
    for (const id of ids) assert.ok(mapped.has(id), `no source for ${id}`);
  });

  test('reports the line each statement is on', () => {
    const r = mapOf('a = 1\n\npoint p = (0, 0)');
    const byId = new Map(r.sourceMap.map(e => [e.id, e.line]));
    assert.equal(byId.get('a'), 1);
    assert.equal(byId.get('p'), 3);
  });

  test('carries the column, so a jump can land on the statement', () => {
    const entry = mapOf('  a = 1').sourceMap.find(e => e.id === 'a')!;
    assert.equal(entry.line, 1);
    assert.equal(entry.col, 3);
  });

  test('a statement that emits several expressions maps them all to itself', () => {
    const r = mapOf('polygon tri = polygon([(0,0), (1,0), (0,1)])');
    assert.ok(r.sourceMap.length >= 1);
    assert.ok(r.sourceMap.every(e => e.line === 1));
  });

  test('a function definition maps back to its own line', () => {
    const r = mapOf('fn f(x) = x + 1\nb = f(2)');
    const byId = new Map(r.sourceMap.map(e => [e.id, e.line]));
    assert.equal(byId.get('f'), 1);
    assert.equal(byId.get('b'), 2);
  });

  test('every id in the map is a real expression', () => {
    const r = mapOf('a = slider(1, 0, 10)\ncurve c = curve(t -> (t, t), 0..1)\ntext l = text("hi", at=(0, 0))');
    const ids = new Set(r.state.expressions.list.map(e => e.id));
    for (const e of r.sourceMap) assert.ok(ids.has(e.id), `stale id ${e.id}`);
  });

  test('lines stay right when a statement spans more than one line', () => {
    const r = mapOf('a = 1\ncurve c = curve(\n  t -> (t, t),\n  0..1\n)\nb = 2');
    const byId = new Map(r.sourceMap.map(e => [e.id, e.line]));
    assert.equal(byId.get('a'), 1);
    assert.equal(byId.get('c'), 2);
    assert.equal(byId.get('b'), 6);
  });
});
