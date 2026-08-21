import type { CompileResult } from '../src/index';
import type { DesmosExpr } from '../src/compiler/codegen';
import type { ListDelta } from './compile.worker';
import type { MacroError } from '../src/plugin/macro';

export interface CompileWorkerResponse {
  id: number;
  result: CompileResult;
  delta?: ListDelta;
  compileMs: number;
  cached: boolean;
}

export interface ExpandedSource {
  src: string;
  errors: MacroError[];
  lineMap?: number[];
}

export interface PipelineOptions {
  spawn: () => Worker;
  source: () => string;
  expand: (src: string) => Promise<ExpandedSource>;
  prelude: () => string;
  available: () => string[];
  onResult: (result: CompileResult) => void;
  onStatus: (message: string, kind: 'success' | 'error' | 'info') => void;
  now?: () => number;
  log?: (line: string) => void;
}

const DEBOUNCE_MIN = 16;
const DEBOUNCE_MAX = 250;
const DEBOUNCE_FACTOR = 2;
const MAX_WORKER_RESTARTS = 3;

/** owns the compile worker, the typing debounce and the expression list it builds */
export class CompilePipeline {
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private restarts = 0;
  private startedAt = 0;
  private exprs = new Map<string, DesmosExpr>();
  private order: string[] = [];
  private readonly now: () => number;

  debounce = 120;
  overheadMs = 0;
  macroErrors: MacroError[] = [];

  constructor(private opts: PipelineOptions) {
    this.now = opts.now ?? (() => performance.now());
  }

  start(): void {
    this.worker = this.spawn();
  }

  private spawn(): Worker {
    const w = this.opts.spawn();

    w.addEventListener('message', (event: MessageEvent<CompileWorkerResponse>) => {
      const { id, result, delta, compileMs, cached } = event.data;
      if (id !== this.requestId) return;
      if (delta && result.success) result.state.expressions.list = this.applyDelta(delta);
      this.noteTiming(compileMs, cached);
      this.opts.onResult(result);
    });

    w.addEventListener('error', (e: ErrorEvent) => {
      console.error('[compile-worker] error:', e.message);
      if (this.restarts < MAX_WORKER_RESTARTS) {
        this.restarts++;
        this.opts.onStatus(`⚠ Compiler restarting (${this.restarts}/${MAX_WORKER_RESTARTS})…`, 'info');
        w.terminate();
        this.worker = this.spawn();
        void this.run();
      } else {
        this.opts.onStatus('✗ Compiler failed — reload to recover', 'error');
      }
    });

    w.addEventListener('messageerror', () => {
      console.error('[compile-worker] message decode error');
      this.opts.onStatus('✗ Compiler message error', 'error');
    });

    return w;
  }

  /** the worker sends what changed, so the whole list is rebuilt here */
  applyDelta(delta: ListDelta): DesmosExpr[] {
    for (const expr of delta.changed) this.exprs.set(expr.id, expr);
    if (delta.order) {
      this.order = delta.order;
      const keep = new Set(delta.order);
      for (const id of this.exprs.keys()) if (!keep.has(id)) this.exprs.delete(id);
    }
    const list: DesmosExpr[] = [];
    for (const id of this.order) {
      const expr = this.exprs.get(id);
      if (expr) list.push(expr);
    }
    return list;
  }

  // the debounce follows the machine: a slow round trip waits longer before the next try
  noteTiming(compileMs: number, cached: boolean): void {
    if (cached) return;
    const roundTrip = this.now() - this.startedAt;
    this.overheadMs = Math.max(0, roundTrip - compileMs);
    this.debounce = Math.min(DEBOUNCE_MAX, Math.max(DEBOUNCE_MIN, Math.round(roundTrip * DEBOUNCE_FACTOR)));
    this.opts.log?.(
      `[compile] round-trip ${roundTrip.toFixed(1)}ms = pipeline ${compileMs.toFixed(1)}ms + overhead ${this.overheadMs.toFixed(1)}ms → debounce ${this.debounce}ms`,
    );
  }

  schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.run(); }, this.debounce);
  }

  async run(): Promise<void> {
    if (!this.worker) return;
    const src = this.opts.source();
    this.startedAt = this.now();
    this.requestId += 1;
    const id = this.requestId;

    const expanded = src.includes('@')
      ? await this.opts.expand(src)
      : { src, errors: [] as MacroError[], lineMap: undefined };
    if (id !== this.requestId || !this.worker) return;

    this.macroErrors = expanded.errors;
    this.worker.postMessage({
      id,
      src: expanded.src,
      lineMap: expanded.lineMap,
      prelude: this.opts.prelude(),
      available: this.opts.available(),
    });
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.worker?.terminate();
    this.worker = null;
  }
}
