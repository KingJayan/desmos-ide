/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { heldBounds, scaledFill } from '../../renderer/desmos';

const square = { pxW: 800, pxH: 800, perPxX: 0.025, perPxY: 0.025 };
const math = { left: -10, right: 10, bottom: -10, top: 10 };

describe('the graph keeps its picture when a sidebar opens', () => {
  test('a narrower graph keeps the scale and the center', () => {
    const held = heldBounds(square, { ...square, pxW: 400 }, math)!;
    assert.equal(held.right - held.left, 10);
    assert.equal(held.top - held.bottom, 20);
    assert.equal((held.left + held.right) / 2, 0);
    assert.equal((held.top + held.bottom) / 2, 0);
  });

  test('the center moves with the graph, not to the origin', () => {
    const held = heldBounds(square, { ...square, pxW: 400 }, {
      left: 30, right: 50, bottom: 100, top: 120,
    })!;
    assert.equal((held.left + held.right) / 2, 40);
    assert.equal((held.top + held.bottom) / 2, 110);
  });

  test('each axis keeps its own scale', () => {
    const held = heldBounds({ ...square, perPxY: 0.1 }, { ...square, pxH: 400 }, math)!;
    assert.equal(held.top - held.bottom, 40);
  });

  test('a pan or a zoom writes nothing back', () => {
    assert.equal(heldBounds(square, { ...square, perPxX: 0.05, perPxY: 0.05 }, math), null);
  });
});

describe('a fill keeps its weight when the background changes', () => {
  test('a light theme takes a lighter share of the stated opacity', () => {
    assert.equal(scaledFill('0.2', 0.55), '0.11');
  });

  test('a dark theme draws exactly what the file says', () => {
    assert.equal(scaledFill('0.2', 1), '0.2');
  });

  test('an expression with no fill stays without one', () => {
    assert.equal(scaledFill(undefined, 0.55), undefined);
  });

  test('an opacity the DSL wrote as an expression is left alone', () => {
    assert.equal(scaledFill('a/2', 0.55), 'a/2');
  });
});
