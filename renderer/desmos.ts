import type { DesmosExpr } from '../src/compiler/codegen';
import { fillScale as themeFillScale, themeSpec, type ColorTheme } from './themes';
import { fingerprint } from './expr-fingerprint';

function themeSettings(theme: ColorTheme): { backgroundColor: string; textColor: string } {
  const spec = themeSpec(theme);
  return { backgroundColor: spec.background, textColor: spec.axis };
}

const SETTLE_MS = 600;
const CHUNK = 60;

export function scaledFill(fillOpacity: string | undefined, scale: number): string | undefined {
  if (fillOpacity === undefined || scale === 1) return fillOpacity;
  const value = Number(fillOpacity);
  if (!Number.isFinite(value)) return fillOpacity;
  return String(Math.round(value * scale * 1000) / 1000);
}

function toSetExpression(expr: DesmosExpr, fillScale: number): Record<string, unknown> {
  const { slider, ...rest } = expr;
  const out: Record<string, unknown> = { ...rest };
  const fill = scaledFill(expr.fillOpacity, fillScale);
  if (fill !== undefined) out.fillOpacity = fill;
  if (!slider) return out;

  if (slider.min !== undefined || slider.max !== undefined || slider.step !== undefined) {
    out.sliderBounds = { min: slider.min, max: slider.max, step: slider.step };
  }
  if (slider.isPlaying !== undefined) out.playing = slider.isPlaying;
  if (slider.animationPeriod !== undefined) out.animationPeriod = slider.animationPeriod;
  if (slider.loopMode !== undefined) out.loopMode = slider.loopMode;
  return out;
}

export interface GraphView {
  pxW: number;
  pxH: number;
  perPxX: number;
  perPxY: number;
}

export interface MathBounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export function heldBounds(before: GraphView, now: GraphView, math: MathBounds): MathBounds | null {
  if (now.pxW === before.pxW && now.pxH === before.pxH) return null;
  const cx = (math.left + math.right) / 2;
  const cy = (math.top + math.bottom) / 2;
  const halfW = now.pxW * before.perPxX / 2;
  const halfH = now.pxH * before.perPxY / 2;
  return { left: cx - halfW, right: cx + halfW, bottom: cy - halfH, top: cy + halfH };
}

export class DesmosGraph {
  private calc: DesmosCalculator;
  private theme: ColorTheme = 'dsmx';
  private snapshots = new Map<string, string>();
  private drawn = new Map<string, DesmosExpr>();

  constructor(container: HTMLElement) {
    this.calc = Desmos.GraphingCalculator(container, {
      expressionsList: false,
      expressions: false,
      settingsMenu: false,
      keypad: false,
      zoomButtons: true,
      lockViewport: false,
      border: false,
      ...themeSettings(this.theme),
      showResetButtonOnGraphpaper: true,
    });
    this.holdViewOnResize();
  }

  private view: GraphView | null = null;

  private holdViewOnResize(): void {
    const read = (): GraphView | null => {
      const b = this.calc.graphpaperBounds;
      if (!b || !b.pixelCoordinates.width || !b.pixelCoordinates.height) return null;
      return {
        pxW: b.pixelCoordinates.width,
        pxH: b.pixelCoordinates.height,
        perPxX: b.mathCoordinates.width / b.pixelCoordinates.width,
        perPxY: b.mathCoordinates.height / b.pixelCoordinates.height,
      };
    };

    if (typeof this.calc.observe !== 'function' || typeof this.calc.setMathBounds !== 'function') return;
    this.view = read();

    this.calc.observe('graphpaperBounds', () => {
      const now = read();
      const before = this.view;
      if (!now) return;

      const held = before && heldBounds(before, now, this.calc.graphpaperBounds!.mathCoordinates);
      if (!before || !held) {
        this.view = now;
        return;
      }

      this.view = { pxW: now.pxW, pxH: now.pxH, perPxX: before.perPxX, perPxY: before.perPxY };
      this.calc.setMathBounds!(held);
    });
  }

  viewport(): { xmin: number; xmax: number; ymin: number; ymax: number } | null {
    const m = this.calc.graphpaperBounds?.mathCoordinates;
    if (!m) return null;
    return { xmin: m.left, xmax: m.right, ymin: m.bottom, ymax: m.top };
  }

  setTheme(theme: ColorTheme): void {
    const before = themeFillScale(this.theme);
    this.theme = theme;
    this.calc.updateSettings(themeSettings(theme));

    if (themeFillScale(theme) === before) return;
    for (const expr of this.drawn.values()) {
      if (expr.fillOpacity !== undefined) this.setOne(expr);
    }
  }

  onExpressionEdited(cb: (exprs: DesmosExpr[]) => void): void {
    const calc = this.calc as DesmosCalculator & {
      observeEvent?(name: string, handler: () => void): void;
    };
    if (typeof calc.observeEvent !== 'function') return;

    this.editedCb = cb;
    calc.observeEvent('change', () => this.reconcile());
  }

  private reconcile(): void {
    const cb = this.editedCb;
    if (!cb) return;

    const wait = this.settleUntil - Date.now();
    if (wait > 0) {
      if (this.recheck === null) {
        this.recheck = setTimeout(() => { this.recheck = null; this.reconcile(); }, wait + 16);
      }
      return;
    }

    const edited: DesmosExpr[] = [];
    for (const expr of this.currentList()) {
      const print = fingerprint(expr);
      if (this.observed.get(expr.id) === print) continue;
      this.observed.set(expr.id, print);
      if (!this.written.has(expr.id)) edited.push(expr);
    }
    this.written.clear();
    if (edited.length) cb(edited);
  }

  private hold(ids: Iterable<string>): void {
    this.settleUntil = Date.now() + SETTLE_MS;
    for (const id of ids) this.written.add(id);
  }

  private settleUntil = 0;
  private observed = new Map<string, string>();
  private written = new Set<string>();
  private recheck: ReturnType<typeof setTimeout> | null = null;
  private editedCb: ((exprs: DesmosExpr[]) => void) | null = null;

  private queued = new Map<string, DesmosExpr>();
  private flushHandle: number | null = null;

  update(list: DesmosExpr[]): void {
    const incoming = this.drawn;
    incoming.clear();

    for (const expr of list) {
      incoming.set(expr.id, expr);
      if (this.snapshots.get(expr.id) !== fingerprint(expr)) this.queued.set(expr.id, expr);
    }

    for (const id of [...this.queued.keys()]) if (!incoming.has(id)) this.queued.delete(id);

    const toRemove: string[] = [];
    for (const id of this.snapshots.keys()) {
      if (!incoming.has(id)) toRemove.push(id);
    }
    for (const id of toRemove) this.snapshots.delete(id);

    if (toRemove.length === 0 && this.queued.size === 0) return;
    this.hold(toRemove);
    for (const id of toRemove) {
      this.calc.removeExpression({ id });
      this.observed.delete(id);
    }

    if (this.queued.size <= CHUNK) this.flush();
    else this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushHandle !== null) return;
    this.flushHandle = requestAnimationFrame(() => this.flush());
  }

  private flush(): void {
    if (this.flushHandle !== null) {
      cancelAnimationFrame(this.flushHandle);
      this.flushHandle = null;
    }
    const batch = [...this.queued.values()].slice(0, CHUNK);
    if (batch.length === 0) return;

    this.hold(batch.map(e => e.id));
    const scale = themeFillScale(this.theme);
    this.calc.setExpressions(batch.map(e => toSetExpression(e, scale)));
    for (const expr of batch) {
      this.queued.delete(expr.id);
      this.snapshots.set(expr.id, fingerprint(expr));
    }
    if (this.queued.size > 0) this.scheduleFlush();
  }

  private setOne(expr: DesmosExpr): void {
    this.hold([expr.id]);
    this.calc.setExpression(toSetExpression(expr, themeFillScale(this.theme)));
  }

  currentList(): DesmosExpr[] {
    return this.calc.getExpressions() as unknown as DesmosExpr[];
  }

  onSelectionChange(cb: (id: string | null) => void): void {
    if (typeof this.calc.observe !== 'function') return;
    this.selectionCb = cb;
    this.calc.observe('selectedExpressionId', () => {
      const id = this.calc.selectedExpressionId ?? null;
      if (id === this.selfSelected) return;
      this.selectionCb?.(id);
    });
  }

  select(id: string | null): void {
    if (this.calc.selectedExpressionId === (id ?? undefined)) return;
    this.selfSelected = id;
    try {
      this.calc.controller?.dispatch?.(
        id ? { type: 'set-selected-id', id } : { type: 'set-none-selected' },
      );
    } catch {
    }
  }

  private selectionCb: ((id: string | null) => void) | null = null;
  private selfSelected: string | null = null;

  setClockPlaying(id: string, playing: boolean): void {
    this.hold([id]);
    this.calc.setExpression({ id, playing });
  }

  setClockPeriod(id: string, period: number): void {
    this.hold([id]);
    this.calc.setExpression({ id, animationPeriod: period });
  }

  setClockValue(id: string, name: string, value: number): void {
    this.hold([id]);
    this.calc.setExpression({ id, latex: `${name}=${value}`, playing: false });
  }

  watchClock(latexName: string, cb: (value: number) => void): () => void {
    if (typeof this.calc.HelperExpression !== 'function') return () => {};
    const helper = this.calc.HelperExpression({ latex: latexName });
    helper.observe('numericValue', () => cb(helper.numericValue));
    return () => helper.unobserve?.('numericValue');
  }

  screenshot(): string | null {
    try {
      return (this.calc as unknown as { screenshot: () => string }).screenshot();
    } catch {
      return null;
    }
  }

  image(format: 'png' | 'svg'): Promise<string | null> {
    if (typeof this.calc.asyncScreenshot !== 'function') {
      return Promise.resolve(format === 'png' ? this.screenshot() : null);
    }
    return new Promise(resolve => {
      const done = (data: string) => resolve(data || null);
      try {
        this.calc.asyncScreenshot!({ format, targetPixelRatio: format === 'png' ? 2 : 1 }, done);
      } catch {
        resolve(null);
      }
    });
  }
}
