import type { DesmosExpr } from '../src/compiler/codegen';
import type { ColorTheme } from './settings';
import { fingerprint } from './expr-fingerprint';

type DesmosThemeSpec = {
  background: string;
  text: string;
  fillScale: number;
};

const DESMOS_THEMES: Record<ColorTheme, DesmosThemeSpec> = {
  dsmx: { background: '#0e1420', text: '#5d6878', fillScale: 1 },
  'dsmx-light': { background: '#ffffff', text: '#8b95a5', fillScale: 0.55 },
  'desmos-dark': { background: '#24273a', text: '#7f849c', fillScale: 1 },
  'catppuccin-latte': { background: '#eff1f5', text: '#9ca0b0', fillScale: 0.55 },
  'catppuccin-frappe': { background: '#303446', text: '#737994', fillScale: 1 },
  'catppuccin-macchiato': { background: '#24273a', text: '#8087a2', fillScale: 1 },
  'github-dark': { background: '#0d1117', text: '#8b949e', fillScale: 1 },
  'github-light': { background: '#ffffff', text: '#8c959f', fillScale: 0.55 },
  monokai: { background: '#272822', text: '#90908a', fillScale: 1 },
  'vs-dark': { background: '#1e1e1e', text: '#9da0a6', fillScale: 1 },
  'vs-light': { background: '#ffffff', text: '#949494', fillScale: 0.55 },
};

function themeSettings(theme: ColorTheme): { backgroundColor: string; textColor: string } {
  const spec = DESMOS_THEMES[theme];
  return { backgroundColor: spec.background, textColor: spec.text };
}

const SETTLE_MS = 600;

/** expressions written to desmos in one frame */
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
    const before = DESMOS_THEMES[this.theme].fillScale;
    this.theme = theme;
    this.calc.updateSettings(themeSettings(theme));

    if (DESMOS_THEMES[theme].fillScale === before) return;
    this.settleUntil = Date.now() + SETTLE_MS;
    for (const expr of this.drawn.values()) {
      if (expr.fillOpacity !== undefined) this.setOne(expr);
    }
  }

  onExpressionEdited(cb: (exprs: DesmosExpr[]) => void): void {
    const calc = this.calc as DesmosCalculator & {
      observeEvent?(name: string, handler: () => void): void;
    };
    if (typeof calc.observeEvent !== 'function') return;

    calc.observeEvent('change', () => {
      const settling = this.settleUntil > Date.now();
      const edited: DesmosExpr[] = [];

      for (const expr of this.currentList()) {
        const print = fingerprint(expr);
        if (this.observed.get(expr.id) !== print) {
          this.observed.set(expr.id, print);
          if (!settling) edited.push(expr);
        }
      }
      if (edited.length) cb(edited);
    });
  }

  private settleUntil = 0;
  private observed = new Map<string, string>();

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
    this.settleUntil = Date.now() + SETTLE_MS;
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

    this.settleUntil = Date.now() + SETTLE_MS;
    const scale = DESMOS_THEMES[this.theme].fillScale;
    this.calc.setExpressions(batch.map(e => toSetExpression(e, scale)));
    for (const expr of batch) {
      this.queued.delete(expr.id);
      this.snapshots.set(expr.id, fingerprint(expr));
    }
    if (this.queued.size > 0) this.scheduleFlush();
  }

  private setOne(expr: DesmosExpr): void {
    this.calc.setExpression(toSetExpression(expr, DESMOS_THEMES[this.theme].fillScale));
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
    this.settleUntil = Date.now() + SETTLE_MS;
    this.calc.setExpression({ id, playing });
  }

  setClockPeriod(id: string, period: number): void {
    this.settleUntil = Date.now() + SETTLE_MS;
    this.calc.setExpression({ id, animationPeriod: period });
  }

  setClockValue(id: string, name: string, value: number): void {
    this.settleUntil = Date.now() + SETTLE_MS;
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
