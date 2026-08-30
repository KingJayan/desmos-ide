/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSliderVars, sliderRange } from '../monaco/sliders';
import { errorToMarker } from '../monaco/language';
import type { CompileErrorLike } from '../monaco/language';
import { compile } from '../index';
import type { CompileFailure } from '../index';

describe('inline sliders', () => {
  test('finds the dsl slider declaration', () => {
    const [s] = parseSliderVars('a = slider(0, 0, 10)');
    assert.equal(s.name, 'a');
    assert.equal(s.value, 0);
    assert.equal(s.domainMin, 0);
    assert.equal(s.domainMax, 10);
  });

  test('col points at the value literal', () => {
    const src = 'a = slider(3, 0, 10)';
    const [s] = parseSliderVars(src);
    assert.equal(src.slice(s.col - 1, s.col - 1 + s.numStr.length), '3');
  });

  test('handles negatives and decimals', () => {
    const [s] = parseSliderVars('  b = slider(-2.5, -5, 5)');
    assert.equal(s.value, -2.5);
    assert.equal(s.domainMin, -5);
    assert.equal(s.numStr, '-2.5');
  });

  test('reads an explicit step kwarg', () => {
    const [s] = parseSliderVars('a = slider(3, 0, 10, step=0.1, speed=1, loop=true)');
    assert.equal(sliderRange(s).step, 0.1);
  });

  test('infers step 1 for whole-number bounds', () => {
    assert.equal(sliderRange(parseSliderVars('a = slider(0, 0, 10)')[0]).step, 1);
  });

  test('infers a fine step when any bound is fractional', () => {
    assert.equal(sliderRange(parseSliderVars('a = slider(0, 0, 6.28)')[0]).step, 0.01);
  });

  test('ignores a slider written inside a comment', () => {
    assert.equal(parseSliderVars('// a = slider(0, 0, 10)').length, 0);
  });

  test('ignores an empty range', () => {
    assert.equal(parseSliderVars('a = slider(1, 5, 5)').length, 0);
  });

  test('ignores non-slider statements', () => {
    assert.equal(parseSliderVars('x = 3\nfn f(a) = a\npoint p = (1, 2)').length, 0);
  });

  test('reports one-based line numbers', () => {
    const [s] = parseSliderVars('x = 1\n\na = slider(0, 0, 10)');
    assert.equal(s.line, 3);
  });
});

describe('error markers', () => {
  const err = (o: Partial<CompileErrorLike> & { message: string }): CompileErrorLike =>
    ({ error: o.message, phase: 1, ...o });

  test('maps a compile error onto a monaco range', () => {
    const m = errorToMarker(err({ message: 'bad', line: 3, col: 5 }))!;
    assert.equal(m.startLineNumber, 3);
    assert.equal(m.startColumn, 5);
    assert.equal(m.endColumn, 6, 'a marker with no token length still covers one column');
    assert.equal(m.severity, 8);
  });

  test('spans the whole token when endCol is known', () => {
    assert.equal(errorToMarker(err({ message: 'bad', line: 1, col: 2, endCol: 9 }))!.endColumn, 9);
  });

  test('appends a suggested fix to the message', () => {
    assert.match(errorToMarker(err({ message: 'bad', line: 1, col: 1, fix: 'try x' }))!.message, /Fix: try x/);
  });

  test('drops an error with no position', () => {
    assert.equal(errorToMarker(err({ message: 'bad' })), null);
  });
});

describe('compile errors reach the editor', () => {
  test('every reported error can be placed in the gutter', () => {
    const r = compile('y = undefinedThing\nz = ((');
    assert.equal(r.success, false);
    const errors = (r as CompileFailure).errors;
    assert.ok(errors.length > 0);
    for (const e of errors) {
      assert.ok(errorToMarker(e), `error without a position: ${e.message}`);
    }
  });
});
