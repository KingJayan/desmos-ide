/// <reference types="node" />
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DesmosExpr } from '../compiler/codegen';

// the pipeline talks to a worker, so the test gives it one it can drive by hand
class FakeWorker {
  static made: FakeWorker[] = [];
  posted: Record<string, unknown>[] = [];
  terminated = false;
  private listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor() { FakeWorker.made.push(this); }

  addEventListener(type: string, fn: (event: unknown) => void): void {
    const held = this.listeners.get(type) ?? [];
    held.push(fn);
    this.listeners.set(type, held);
  }

  postMessage(msg: Record<string, unknown>): void { this.posted.push(msg); }
  terminate(): void { this.terminated = true; }

  emit(type: string, event: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}

const { CompilePipeline } = await import('../../renderer/compile-pipeline');

type Options = ConstructorParameters<typeof CompilePipeline>[0];

const okResult = (list: DesmosExpr[]) => ({
  success: true,
  state: { expressions: { list } },
}) as unknown as import('../index').CompileResult;

function build(over: Partial<Options> = {}): {
  pipeline: InstanceType<typeof CompilePipeline>;
  results: unknown[];
  status: string[];
  clock: { at: number };
} {
  const results: unknown[] = [];
  const status: string[] = [];
  const clock = { at: 0 };
  const pipeline = new CompilePipeline({
    spawn: () => new FakeWorker() as unknown as Worker,
    source: () => 'x = 1',
    expand: src => Promise.resolve({ src, errors: [] }),
    prelude: () => '',
    available: () => [],
    onResult: r => results.push(r),
    onStatus: m => status.push(m),
    now: () => clock.at,
    ...over,
  });
  return { pipeline, results, status, clock };
}

describe('the compile pipeline', () => {
  beforeEach(() => { FakeWorker.made = []; });

  test('a request carries the source, the prelude and the plugin list', async () => {
    const { pipeline } = build({ prelude: () => 'fn f(x) = x', available: () => ['starfield'] });
    pipeline.start();
    await pipeline.run();
    const sent = FakeWorker.made[0].posted[0];
    assert.equal(sent.src, 'x = 1');
    assert.equal(sent.prelude, 'fn f(x) = x');
    assert.deepEqual(sent.available, ['starfield']);
    pipeline.dispose();
  });

  test('macros are only expanded when the source calls one', async () => {
    let expansions = 0;
    const { pipeline } = build({
      expand: src => { expansions++; return Promise.resolve({ src, errors: [] }); },
    });
    pipeline.start();
    await pipeline.run();
    assert.equal(expansions, 0);
    pipeline.dispose();
  });

  test('a result from an older request is ignored', async () => {
    const { pipeline, results } = build();
    pipeline.start();
    await pipeline.run();
    await pipeline.run();
    FakeWorker.made[0].emit('message', { data: { id: 1, result: okResult([]), compileMs: 1, cached: false } });
    assert.deepEqual(results, []);
    FakeWorker.made[0].emit('message', { data: { id: 2, result: okResult([]), compileMs: 1, cached: false } });
    assert.equal(results.length, 1);
    pipeline.dispose();
  });

  test('a delta rebuilds the whole list in the order the worker gave', async () => {
    const { pipeline } = build();
    pipeline.start();
    const a = { type: 'expression', id: 'a', latex: 'y=1' } as DesmosExpr;
    const b = { type: 'expression', id: 'b', latex: 'y=2' } as DesmosExpr;
    assert.deepEqual(pipeline.applyDelta({ changed: [a, b], order: ['b', 'a'] }), [b, a]);
    // a later delta drops what the order no longer holds
    assert.deepEqual(pipeline.applyDelta({ changed: [], order: ['a'] }), [a]);
    pipeline.dispose();
  });

  test('the debounce follows the round trip, inside its bounds', () => {
    const { pipeline, clock } = build();
    pipeline.start();
    clock.at = 400;
    pipeline.noteTiming(10, false);
    assert.equal(pipeline.debounce, 250);
    clock.at = 20;
    pipeline.noteTiming(1, false);
    assert.equal(pipeline.debounce, 40);
    assert.equal(pipeline.overheadMs, 19);
    pipeline.dispose();
  });

  test('a cached compile does not move the debounce', () => {
    const { pipeline, clock } = build();
    pipeline.start();
    clock.at = 400;
    pipeline.noteTiming(10, true);
    assert.equal(pipeline.debounce, 120);
    pipeline.dispose();
  });

  test('a worker that fails is replaced, but only three times', () => {
    const { pipeline, status } = build();
    pipeline.start();
    for (let i = 0; i < 4; i++) {
      const worker = FakeWorker.made[FakeWorker.made.length - 1];
      worker.emit('error', { message: 'boom' });
    }
    assert.equal(FakeWorker.made.length, 4);
    assert.equal(status[status.length - 1], '✗ Compiler failed — reload to recover');
    pipeline.dispose();
  });

  test('a disposed pipeline sends nothing more', async () => {
    const { pipeline } = build();
    pipeline.start();
    pipeline.dispose();
    await pipeline.run();
    assert.equal(FakeWorker.made[0].terminated, true);
    assert.deepEqual(FakeWorker.made[0].posted, []);
  });
});
