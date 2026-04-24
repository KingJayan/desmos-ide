import type { DesmosExpr } from '../src/compiler/codegen';
import type { ColorTheme } from './settings';

type DesmosThemeSpec = {
  background: string;
  major: string;
  minor: string;
  axis: string;
  label: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipBorder: string;
};

const DESMOS_THEMES: Record<ColorTheme, DesmosThemeSpec> = {
  'desmos-dark': {
    background: '#24273a',
    major: '#494d64',
    minor: '#363a4f',
    axis: '#939ab7',
    label: '#7f849c',
    tooltipBg: '#313244',
    tooltipText: '#cdd6f4',
    tooltipBorder: '#45475a',
  },
  'catppuccin-latte': {
    background: '#eff1f5',
    major: '#bcc0cc',
    minor: '#ccd0da',
    axis: '#6c6f85',
    label: '#7c7f93',
    tooltipBg: '#e6e9ef',
    tooltipText: '#4c4f69',
    tooltipBorder: '#bcc0cc',
  },
  'catppuccin-frappe': {
    background: '#303446',
    major: '#51576d',
    minor: '#414559',
    axis: '#b5bfe2',
    label: '#737994',
    tooltipBg: '#414559',
    tooltipText: '#c6d0f5',
    tooltipBorder: '#626880',
  },
  'catppuccin-macchiato': {
    background: '#24273a',
    major: '#494d64',
    minor: '#363a4f',
    axis: '#b8c0e0',
    label: '#8087a2',
    tooltipBg: '#363a4f',
    tooltipText: '#cad3f5',
    tooltipBorder: '#494d64',
  },
  'github-dark': {
    background: '#0d1117',
    major: '#30363d',
    minor: '#21262d',
    axis: '#8b949e',
    label: '#8b949e',
    tooltipBg: '#161b22',
    tooltipText: '#e6edf3',
    tooltipBorder: '#30363d',
  },
  'github-light': {
    background: '#ffffff',
    major: '#d0d7de',
    minor: '#eaeef2',
    axis: '#57606a',
    label: '#57606a',
    tooltipBg: '#f6f8fa',
    tooltipText: '#24292f',
    tooltipBorder: '#d0d7de',
  },
  monokai: {
    background: '#272822',
    major: '#49483e',
    minor: '#3e3d32',
    axis: '#90908a',
    label: '#90908a',
    tooltipBg: '#3e3d32',
    tooltipText: '#f8f8f2',
    tooltipBorder: '#5a594d',
  },
  'vs-dark': {
    background: '#1e1e1e',
    major: '#3c3c3c',
    minor: '#2a2a2a',
    axis: '#9da0a6',
    label: '#9da0a6',
    tooltipBg: '#252526',
    tooltipText: '#d4d4d4',
    tooltipBorder: '#3c3c3c',
  },
  'vs-light': {
    background: '#ffffff',
    major: '#e5e5e5',
    minor: '#f2f2f2',
    axis: '#616161',
    label: '#616161',
    tooltipBg: '#f3f3f3',
    tooltipText: '#333333',
    tooltipBorder: '#d9d9d9',
  },
};

function buildThemeCss(theme: DesmosThemeSpec): string {
  return `
  .dcg-exppanel-outer,
  .dcg-exppanel,
  .dcg-expressions-container,
  .dcg-expression-edit-actions-container,
  [class*="exppanel"],
  [class*="expressions-container"] { display: none !important; }

  .dcg-header,
  .dcg-header-btn-container,
  [class*="dcg-header"] { display: none !important; }

  .dcg-expressionstoggle,
  .dcg-expressions-toggle,
  [class*="expressionstoggle"],
  [class*="expressions-toggle"],
  [class*="toggle-container"] { display: none !important; }

  .dcg-graphpaper-branding,
  .dcg-watermark,
  .dcg-powered-by,
  .dcg-powered-by-desmos { display: none !important; }

  .dcg-label,
  .dcg-axis-label { color: ${theme.label} !important; }

  .dcg-svg-background,
  .dcg-graphpaper-background {
    fill: ${theme.background} !important;
  }

  .dcg-major-grid line,
  .dcg-grid-major line {
    stroke: ${theme.major} !important;
  }

  .dcg-minor-grid line,
  .dcg-grid-minor line {
    stroke: ${theme.minor} !important;
    opacity: 0.65 !important;
  }

  .dcg-axis line,
  .dcg-axes line {
    stroke: ${theme.axis} !important;
    opacity: 0.85 !important;
  }

  .dcg-mq-root-block,
  .dcg-mq-root-block * { color: ${theme.tooltipText} !important; }

  .dcg-tooltip-container {
    background: ${theme.tooltipBg} !important;
    color: ${theme.tooltipText} !important;
    border-color: ${theme.tooltipBorder} !important;
  }

  .dcg-zoom-fit,
  .dcg-zoom-in,
  .dcg-zoom-out,
  [class*="zoom"] {
    opacity: 0.7;
  }
  [class*="zoom"]:hover { opacity: 1; }
`;
}

export class DesmosGraph {
  private calc: DesmosCalculator;
  private container: HTMLElement;
  private theme: ColorTheme = 'desmos-dark';
  private snapshots = new Map<string, string>();

  constructor(container: HTMLElement) {
    this.container = container;
    this.calc = Desmos.GraphingCalculator(container, {
      expressionsList: false,
      expressions: false,
      settingsMenu: false,
      keypad: false,
      zoomButtons: true,
      lockViewport: false,
      border: false,
      backgroundColor: DESMOS_THEMES[this.theme].background,
      showResetButtonOnGraphpaper: true,
    });

    this.pollInjectTheme(container);
  }

  setTheme(theme: ColorTheme): void {
    this.theme = theme;
    this.applyTheme();
  }

  private applyTheme(): void {
    this.calc.updateSettings({ backgroundColor: DESMOS_THEMES[this.theme].background });
    const iframe = this.container.querySelector('iframe') as HTMLIFrameElement | null;
    if (iframe) this.applyThemeToFrame(iframe);
  }

  private themeLoadListener: (() => void) | null = null;

  private applyThemeToFrame(iframe: HTMLIFrameElement): boolean {
    try {
      const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (!doc?.head || doc.readyState === 'loading') return false;
      const styleId = 'dsmx-theme';
      let style = doc.getElementById(styleId) as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement('style');
        style.id = styleId;
        doc.head.appendChild(style);
      }
      style.textContent = buildThemeCss(DESMOS_THEMES[this.theme]);
      return true;
    } catch {
      return false;
    }
  }

  private pollInjectTheme(container: HTMLElement, attempts = 0): void {
    const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
    if (!iframe) {
      if (attempts < 40) setTimeout(() => this.pollInjectTheme(container, attempts + 1), 100);
      return;
    }

    let n = 0;
    const tryInject = () => {
      if (this.applyThemeToFrame(iframe)) return;
      if (n++ < 15) setTimeout(tryInject, 120);
    };

    tryInject();

    if (this.themeLoadListener) iframe.removeEventListener('load', this.themeLoadListener);
    this.themeLoadListener = () => {
      n = 0;
      tryInject();
    };
    iframe.addEventListener('load', this.themeLoadListener);
  }

  update(list: DesmosExpr[]): void {
    const incoming = new Map(list.map(e => [e.id, e]));
    const toSet: DesmosExpr[] = [];
    const toRemove: string[] = [];

    for (const expr of list) {
      const snap = JSON.stringify(expr);
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
    for (const id of toRemove) this.calc.removeExpression({ id });
    for (const expr of toSet) this.calc.setExpression(expr as unknown as Record<string, unknown>);
  }

  currentList(): DesmosExpr[] {
    return this.calc.getExpressions() as unknown as DesmosExpr[];
  }

  screenshot(): string | null {
    try {
      return (this.calc as unknown as { screenshot: () => string }).screenshot();
    } catch {
      return null;
    }
  }
}
