/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSliderVars, sliderRange } from '../monaco/sliders';

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
    const [s] = parseSliderVars('a = slider(3, 0, 10, step=0.1, speed=1, loop)');
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
    assert.equal(parseSliderVars('x = 3\nfn f(a) = a\npoint p (1, 2)').length, 0);
  });

  test('reports one-based line numbers', () => {
    const [s] = parseSliderVars('x = 1\n\na = slider(0, 0, 10)');
    assert.equal(s.line, 3);
  });
});
