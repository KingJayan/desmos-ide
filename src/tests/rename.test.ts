/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findRenameEdits, isValidIdent } from '../compiler/rename';

/** apply the edits the way monaco would, so a test reads as the result */
function rename(src: string, from: string, to: string): string {
  const lines = src.split('\n');
  const edits = findRenameEdits(src, from);
  // right to left, so an earlier edit cannot move a later one
  for (const e of [...edits].sort((a, b) => b.line - a.line || b.col - a.col)) {
    const line = lines[e.line - 1];
    lines[e.line - 1] = line.slice(0, e.col - 1) + to + line.slice(e.col - 1 + e.length);
  }
  return lines.join('\n');
}

describe('renaming a symbol', () => {
  test('renames every use', () => {
    assert.equal(rename('a = 3\nb = a + a', 'a', 'q'), 'q = 3\nb = q + q');
  });

  test('leaves a string literal alone', () => {
    assert.equal(
      rename('a = 3\ntext lbl = "plot a here" at (0, 0)', 'a', 'b'),
      'b = 3\ntext lbl = "plot a here" at (0, 0)',
    );
  });

  test('leaves a comment alone', () => {
    assert.equal(rename('a = 3 // tune a', 'a', 'b'), 'b = 3 // tune a');
  });

  test('the reported failure: a string and a comment together', () => {
    const src = 'a = 3\ntext lbl = "plot a here" at (0, 0) // tune a';
    const out = rename(src, 'a', 'b');
    assert.equal(out, 'b = 3\ntext lbl = "plot a here" at (0, 0) // tune a');
  });

  test('does not touch a name that only contains the target', () => {
    assert.equal(rename('a = 3\nab = 4\nba = 5', 'a', 'q'), 'q = 3\nab = 4\nba = 5');
  });

  test('renames across a statement that spans lines', () => {
    assert.equal(
      rename('a = 1\ncurve c (t in 0..1) {\n  (t, a)\n}', 'a', 'z'),
      'z = 1\ncurve c (t in 0..1) {\n  (t, z)\n}',
    );
  });

  test('renames a function and its call sites', () => {
    assert.equal(rename('fn f(x) = x + 1\nb = f(2)', 'f', 'g'), 'fn g(x) = x + 1\nb = g(2)');
  });

  test('a greek use is one identifier, and its source span is one character', () => {
    const edits = findRenameEdits('α = 1\nb = alpha + α', 'alpha');
    assert.equal(edits.length, 3);
    assert.deepEqual(edits.map(e => e.length), [1, 5, 1]);
    assert.equal(rename('α = 1\nb = alpha + α', 'alpha', 'w'), 'w = 1\nb = w + w');
  });

  test('a name that is not there produces nothing', () => {
    assert.deepEqual(findRenameEdits('a = 1', 'zz'), []);
  });

  test('a file that does not lex renames nothing', () => {
    assert.deepEqual(findRenameEdits('a = "unterminated', 'a'), []);
  });
});

describe('a name a rename may write', () => {
  test('accepts ordinary names', () => {
    for (const n of ['a', 'b2', 'long_name', '_x']) assert.ok(isValidIdent(n), n);
  });

  test('refuses a keyword', () => {
    assert.equal(isValidIdent('point'), false);
    assert.equal(isValidIdent('region'), false);
  });

  test('refuses anything that is not one identifier', () => {
    for (const n of ['', '2a', 'a b', 'a+b', 'a-b', '"a"']) assert.equal(isValidIdent(n), false, n);
  });

  test('accepts a greek name, which normalises to an identifier', () => {
    assert.ok(isValidIdent('α'));
  });
});
