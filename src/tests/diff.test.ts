/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lineDiff } from '../../renderer/diff';

/** the diff as a patch reads, so a test says what the user sees */
function patch(before: string, after: string): string {
  return lineDiff(before, after).map(d => `${d.op}${d.line}`).join('\n');
}

describe('the line diff', () => {
  test('marks every line unchanged when nothing changed', () => {
    assert.equal(patch('a\nb\nc', 'a\nb\nc'), '=a\n=b\n=c');
  });

  test('finds an inserted line', () => {
    assert.equal(patch('a\nc', 'a\nb\nc'), '=a\n+b\n=c');
  });

  test('finds a deleted line', () => {
    assert.equal(patch('a\nb\nc', 'a\nc'), '=a\n-b\n=c');
  });

  test('a changed line reads as one delete and one insert', () => {
    const d = lineDiff('a\nb\nc', 'a\nB\nc');
    assert.deepEqual(d.filter(l => l.op === '-'), [{ op: '-', line: 'b' }]);
    assert.deepEqual(d.filter(l => l.op === '+'), [{ op: '+', line: 'B' }]);
  });

  test('an empty before is all insertions, less the one empty line it splits into', () => {
    assert.equal(patch('', 'a\nb'), '+a\n+b\n-');
  });

  test('every unchanged line survives a move around it', () => {
    const kept = lineDiff('x = 1\ny = 2', 'z = 0\nx = 1\ny = 2').filter(d => d.op === '=');
    assert.deepEqual(kept.map(d => d.line), ['x = 1', 'y = 2']);
  });

  test('the result rebuilds both sides', () => {
    const before = 'a\nb\nc\nd';
    const after = 'a\nc\nx\nd';
    const d = lineDiff(before, after);
    assert.equal(d.filter(l => l.op !== '+').map(l => l.line).join('\n'), before);
    assert.equal(d.filter(l => l.op !== '-').map(l => l.line).join('\n'), after);
  });
});
