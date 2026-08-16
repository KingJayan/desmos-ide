/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPEEDS, formatClockValue, formatSpeed, periodFor, scrubToValue, valueToScrub,
} from '../../renderer/transport-state';

describe('the speed to period conversion', () => {
  test('1x leaves the period the source asked for', () => {
    assert.equal(periodFor(4000, 1), 4000);
  });

  test('a faster speed is a shorter period', () => {
    assert.equal(periodFor(4000, 2), 2000);
    assert.equal(periodFor(4000, 4), 1000);
  });

  test('a slower speed is a longer period', () => {
    assert.equal(periodFor(4000, 0.5), 8000);
    assert.equal(periodFor(4000, 0.25), 16000);
  });

  test('it never asks for a period desmos cannot animate', () => {
    assert.equal(periodFor(100, 4), 50);
    assert.equal(periodFor(1, 4), 50);
  });

  test('a nonsense period falls back rather than producing NaN', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      assert.ok(Number.isFinite(periodFor(bad, 1)), String(bad));
    }
  });

  test('every offered speed produces a usable period', () => {
    for (const s of SPEEDS) {
      const p = periodFor(4000, s);
      assert.ok(Number.isFinite(p) && p >= 50, `${s}x gave ${p}`);
    }
  });
});

describe('the scrub position', () => {
  test('maps the ends of the range to the ends of the track', () => {
    assert.equal(valueToScrub(0, 0, 10), 0);
    assert.equal(valueToScrub(10, 0, 10), 1);
    assert.equal(valueToScrub(5, 0, 10), 0.5);
  });

  test('works on a range that does not start at zero', () => {
    assert.equal(valueToScrub(3, 2, 4), 0.5);
  });

  test('a value outside the range stays on the track', () => {
    assert.equal(valueToScrub(-5, 0, 10), 0);
    assert.equal(valueToScrub(99, 0, 10), 1);
  });

  test('an empty range does not divide by zero', () => {
    assert.equal(valueToScrub(5, 5, 5), 0);
  });

  test('a value that is not a number reads as the start', () => {
    assert.equal(valueToScrub(NaN, 0, 10), 0);
  });

  test('the position converts back to the value it came from', () => {
    for (const v of [0, 2.5, 7, 10]) {
      assert.equal(scrubToValue(valueToScrub(v, 0, 10), 0, 10), v);
    }
  });

  test('a position outside the track is clamped', () => {
    assert.equal(scrubToValue(-1, 0, 10), 0);
    assert.equal(scrubToValue(2, 0, 10), 10);
  });
});

describe('the labels', () => {
  test('a whole number is not padded with decimals', () => {
    assert.equal(formatClockValue(3), '3');
    assert.equal(formatClockValue(0), '0');
  });

  test('a fraction gets two decimals', () => {
    assert.equal(formatClockValue(3.14159), '3.14');
  });

  test('a value that is not a number reads as a dash, not NaN', () => {
    assert.equal(formatClockValue(NaN), '—');
  });

  test('the speed reads the way a video player writes it', () => {
    assert.equal(formatSpeed(1), '1x');
    assert.equal(formatSpeed(0.25), '0.25x');
  });
});
