/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compileStatus, errorsByPhase } from '../../renderer/compile-status';
import { compile } from '../index';
import type { CompileError } from '../index';

describe('the status line for a compile', () => {
  test('counts the expressions on success', () => {
    const out = compileStatus(compile('a = 1\nb = 2'));
    assert.equal(out.kind, 'success');
    assert.match(out.msg, /^✓ 2 expressions$/);
  });

  test('a warning reads as info, not as a failure', () => {
    const result = compile('a = 1');
    assert.ok(result.success);
    // the shape a warning takes, without depending on which source produces one
    const withWarning = { ...result, warnings: [{ message: 'w' } as never] };
    const out = compileStatus(withWarning);
    assert.equal(out.kind, 'info');
    assert.match(out.msg, /1 warning$/);
  });

  test('one error is quoted on its own', () => {
    const out = compileStatus(compile('a = zzz'));
    assert.equal(out.kind, 'error');
    assert.match(out.msg, /^✗ /);
    assert.ok(!out.msg.includes('errors —'));
  });

  test('several errors report the count and the first one', () => {
    const result = compile('a = zzz');
    assert.ok(!result.success);
    const many = { ...result, errors: [result.errors[0], { ...result.errors[0], message: 'second' }] };
    const out = compileStatus(many);
    assert.match(out.msg, /^✗ 2 errors — /);
    assert.ok(out.msg.endsWith(result.errors[0].message));
  });
});

describe('splitting the errors by phase', () => {
  const errs = [
    { message: 'parse', phase: 1 },
    { message: 'name', phase: 2 },
    { message: 'parse two', phase: 1 },
  ] as CompileError[];

  test('sends each error to the set its phase owns', () => {
    const out = errorsByPhase(errs, e => e.message);
    assert.deepEqual(out.syntax, ['parse', 'parse two']);
    assert.deepEqual(out.semantic, ['name']);
  });

  test('drops an error the mapper cannot place', () => {
    const out = errorsByPhase(errs, e => (e.phase === 1 ? null : e.message));
    assert.deepEqual(out.syntax, []);
    assert.deepEqual(out.semantic, ['name']);
  });

  test('no errors gives two empty sets, so the old markers clear', () => {
    const out = errorsByPhase([], e => e.message);
    assert.deepEqual(out, { syntax: [], semantic: [] });
  });
});
