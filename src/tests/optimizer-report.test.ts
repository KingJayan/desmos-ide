/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../compile';
import { printExpr } from '../compiler/print';
import { groupByLine, lineHint } from '../../renderer/optimizer-panel';
import type { OptimizeNote } from '../compile';

function notes(src: string): OptimizeNote[] {
  const result = compile(src);
  assert.equal(result.success, true);
  return (result as Extract<typeof result, { success: true }>).optimizations;
}

describe('the optimizer reports what it changed', () => {
  test('constant arithmetic is a fold', () => {
    const folds = notes('a = 2*3 + 1\n').filter(n => n.kind === 'fold');
    assert.deepEqual(folds.map(n => `${n.before} -> ${n.after}`), ['2 * 3 -> 6', '6 + 1 -> 7']);
  });

  test('a neutral operand is an identity, not a fold', () => {
    const found = notes('b = x + 0\n');
    assert.equal(found.length, 1);
    assert.equal(found[0]!.kind, 'identity');
    assert.equal(found[0]!.after, 'x');
  });

  test('a call site records the body it was replaced with', () => {
    const inlines = notes('fn f(x) = x^2\nc = f(y)\n').filter(n => n.kind === 'inline');
    assert.deepEqual(inlines.map(n => `${n.before} -> ${n.after}`), ['f(y) -> y ^ 2']);
    assert.equal(inlines[0]!.line, 2);
  });

  test('a variable is never dropped, read or not', () => {
    assert.deepEqual(notes('k = 5\nd = 1\n').filter(n => n.kind === 'drop'), []);
  });

  test('a source with nothing to change reports nothing', () => {
    assert.deepEqual(notes('point p = (1, 2)\n'), []);
  });

  test('one transform is reported once, however many call sites inline it', () => {
    const found = notes('fn f(x) = x + 2*3\ne = f(1) + f(2) + f(3)\n');
    const keys = found.map(n => `${n.line}:${n.col}:${n.before}>${n.after}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  test('a fold inside an inlined body is not blamed on the fn declaration', () => {
    const onLine1 = notes('fn f(x) = x^2 + 0\ng = f(3)\n').filter(n => n.line === 1);
    assert.deepEqual(onLine1.map(n => n.after), ['x ^ 2']);
  });
});

describe('the report groups by line', () => {
  const sample: OptimizeNote[] = [
    { kind: 'fold', line: 4, col: 5, before: '2 * 3', after: '6' },
    { kind: 'fold', line: 2, col: 1, before: '1 + 1', after: '2' },
    { kind: 'fold', line: 4, col: 9, before: '6 + 1', after: '7' },
  ];

  test('lines come out in order, notes keep the order they were made', () => {
    const groups = groupByLine(sample);
    assert.deepEqual(groups.map(g => g.line), [2, 4]);
    assert.deepEqual(groups[1]!.notes.map(n => n.after), ['6', '7']);
  });

  test('the hint shows the outermost result and counts the rest', () => {
    assert.equal(lineHint(groupByLine(sample)[1]!), '⟶ 7  +1');
    assert.equal(lineHint(groupByLine(sample)[0]!), '⟶ 2');
  });

  test('a drop hint says why, with no count', () => {
    const dropped: OptimizeNote[] = [{ kind: 'drop', line: 3, col: 1, before: 'fn k', after: 'never used' }];
    assert.equal(lineHint(groupByLine(dropped)[0]!), '⟶ never used');
  });
});

describe('the printer keeps precedence readable', () => {
  test('a sum inside a product is parenthesised', () => {
    const result = compile('a = 2 * (x + 1)\n');
    assert.equal(result.success, true);
    assert.equal(printExpr({
      type: 'BinOp', op: '*',
      left: { type: 'NumLit', value: 2, pos: { line: 1, col: 1 } },
      right: {
        type: 'BinOp', op: '+',
        left: { type: 'Ident', name: 'x', pos: { line: 1, col: 1 } },
        right: { type: 'NumLit', value: 1, pos: { line: 1, col: 1 } },
        pos: { line: 1, col: 1 },
      },
      pos: { line: 1, col: 1 },
    }), '2 * (x + 1)');
  });
});
