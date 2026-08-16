import type { DesmosExpr } from '../src/compiler/codegen';
import type { ColorTheme } from './settings';

type DesmosThemeSpec = {
  background: string;
  text: string;
};

const DESMOS_THEMES: Record<ColorTheme, DesmosThemeSpec> = {
  'desmos-dark': { background: '#24273a', text: '#7f849c' },
  'catppuccin-latte': { background: '#eff1f5', text: '#7c7f93' },
  'catppuccin-frappe': { background: '#303446', text: '#737994' },
  'catppuccin-macchiato': { background: '#24273a', text: '#8087a2' },
  'github-dark': { background: '#0d1117', text: '#8b949e' },
  'github-light': { background: '#ffffff', text: '#57606a' },
  monokai: { background: '#272822', text: '#90908a' },
  'vs-dark': { background: '#1e1e1e', text: '#9da0a6' },
  'vs-light': { background: '#ffffff', text: '#616161' },
};

function themeSettings(theme: ColorTheme): { backgroundColor: string; textColor: string } {
  const spec = DESMOS_THEMES[theme];
  return { backgroundColor: spec.background, textColor: spec.text };
}

/** desmos settles its own rewrites well inside this window */
const SETTLE_MS = 600;

/** only the parts of an expression the DSL can write */
function fingerprint(expr: DesmosExpr): string {
  return JSON.stringify([
    expr.type, expr.latex ?? '', expr.label ?? '', expr.color ?? '',
    expr.title ?? '',
    expr.slider ? [expr.slider.min ?? '', expr.slider.max ?? ''] : null,
    expr.parametricDomain ? [expr.parametricDomain.min, expr.parametricDomain.max] : null,
  ]);
}

function toSetExpression(expr: DesmosExpr): Record<string, unknown> {
  const { slider, ...rest } = expr;
  const out: Record<string, unknown> = { ...rest };
  if (!slider) return out;

  if (slider.min !== undefined || slider.max !== undefined || slider.step !== undefined) {
    out.sliderBounds = { min: slider.min, max: slider.max, step: slider.step };
  }
  if (slider.isPlaying !== undefined) out.playing = slider.isPlaying;
  if (slider.animationPeriod !== undefined) out.animationPeriod = slider.animationPeriod;
  if (slider.loopMode !== undefined) out.loopMode = slider.loopMode;
  return out;
}

export class DesmosGraph {
  private calc: DesmosCalculator;
  private theme: ColorTheme = 'desmos-dark';
  private snapshots = new Map<string, string>();

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
  }

  setTheme(theme: ColorTheme): void {
    this.theme = theme;
    this.calc.updateSettings(themeSettings(theme));
  }

  /**
   * an edit made on the graph, not by us. desmos rewrites latex into its own
   * normal form, so the baseline is what desmos reports back and never what we
   * sent it; the first report after an update only seeds that baseline.
   */
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

  /** desmos keeps rewriting for a moment after a write, so ignore that window */
  private settleUntil = 0;
  private observed = new Map<string, string>();

  update(list: DesmosExpr[]): void {
    const incoming = new Map(list.map(e => [e.id, e]));
    const toSet: DesmosExpr[] = [];
    const toRemove: string[] = [];

    for (const expr of list) {
      const snap = fingerprint(expr);
      if (this.snapshots.get(expr.id) !== snap) {
        toSet.push(expr);
        this.snapshots.set(expr.id, snap);
      }
    }

    for (const id of this.snapshots.keys()) {
      if (!incoming.has(id)) {
        toRemove.push(id);
        this.snapshots.delete(id);
      }
    }

    if (toRemove.length === 0 && toSet.length === 0) return;
    // writing to the graph fires change events, which must not come back
    this.settleUntil = Date.now() + SETTLE_MS;
    for (const id of toRemove) {
      this.calc.removeExpression({ id });
      this.observed.delete(id);
    }
    for (const expr of toSet) this.calc.setExpression(toSetExpression(expr));
  }

  currentList(): DesmosExpr[] {
    return this.calc.getExpressions() as unknown as DesmosExpr[];
  }

  onSelectionChange(cb: (id: string | null) => void): void {
    if (typeof this.calc.observe !== 'function') return;
    this.selectionCb = cb;
    this.calc.observe('selectedExpressionId', () => {
      const id = this.calc.selectedExpressionId ?? null;
      // ignore the echo of a selection this side just made
      if (id === this.selfSelected) return;
      this.selectionCb?.(id);
    });
  }

  /** the other direction: put the graph's selection on a given expression */
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

  /** moves the clock by hand, which is what scrubbing does */
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
}
