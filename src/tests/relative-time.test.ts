/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime } from '../shared/relative-time';

describe('relative time', () => {
  const now = Date.UTC(2026, 8, 5, 12, 0, 0);
  const ago = (ms: number): string => relativeTime(now - ms, now);

  test('anything under a minute is just now', () => {
    assert.equal(ago(0), 'just now');
    assert.equal(ago(59_000), 'just now');
  });

  test('it picks the largest unit that fits', () => {
    assert.equal(ago(60_000), '1m ago');
    assert.equal(ago(90 * 60_000), '1h ago');
    assert.equal(ago(26 * 3_600_000), '1d ago');
    assert.equal(ago(40 * 24 * 3_600_000), '1mo ago');
    assert.equal(ago(400 * 24 * 3_600_000), '1y ago');
  });

  test('a time in the future does not read as negative', () => {
    assert.equal(ago(-5_000), 'just now');
  });

  test('an unparsable date says so rather than printing NaN', () => {
    assert.equal(relativeTime(Number.NaN, now), 'unknown');
  });
});
