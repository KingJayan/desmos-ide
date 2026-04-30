// code generator

import * as T from './types';

const DESMOS_NAMED: Record<string, string> = {
  red: '#c74440', blue: '#2d70b3', green: '#388c46',
  orange: '#fa7e19', purple: '#6042a6', black: '#000000', white: '#ffffff',
};

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function resolveColor(expr: T.Expr | undefined): string | null {
  if (!expr) return null;
  if (expr.type === 'StringLit') {
    if (expr.value.startsWith('#')) return expr.value;
    return DESMOS_NAMED[expr.value] ?? null;
  }
  if (expr.type === 'Ident' && DESMOS_NAMED[expr.name]) return DESMOS_NAMED[expr.name];
  if (expr.type !== 'Call') return null;
  const nums = expr.args.every(a => a.type === 'NumLit');
  if (!nums) return null;
  const [a0 = 0, a1 = 0, a2 = 0] = (expr.args as T.NumLit[]).map(a => a.value);
  if (expr.fn === 'rgb') return rgbToHex(a0, a1, a2);
  if (expr.fn === 'hsv') { const [r, g, b] = hsvToRgb(a0, a1, a2); return rgbToHex(r, g, b); }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function gradientColorLatex(
  fromExpr: T.Expr, toExpr: T.Expr,
  varLtx: string, startLtx: string, endLtx: string
): string | null {
  const fromHex = resolveColor(fromExpr);
  const toHex   = resolveColor(toExpr);
  if (!fromHex || !toHex) return null;
  const [r1, g1, b1] = hexToRgb(fromHex);
  const [r2, g2, b2] = hexToRgb(toHex);
  const norm = `\\frac{${varLtx}-${startLtx}}{${endLtx}-${startLtx}}`;
  const ch = (a: number, b: number) =>
    b === a ? `${a}` : `${a}+${b - a}\\cdot\\left(${norm}\\right)`;
  return `\\operatorname{rgb}\\left(${ch(r1, r2)},${ch(g1, g2)},${ch(b1, b2)}\\right)`;
}

export interface DesmosSlider {
  min?: string;
  max?: string;
  step?: string;
  hardMin?: boolean;
  hardMax?: boolean;
  isPlaying?: boolean;
  animationPeriod?: number;
  loopMode?: 'LOOP_FORWARD' | 'LOOP_BACKWARD' | 'PLAY_ONCE';
}

export interface DesmosExpr {
  type: 'expression' | 'text' | 'folder';
  id: string;
  latex?: string;
  color?: string;
  colorLatex?: string;
  lineOpacity?: string;
  pointOpacity?: string;
  pointSize?: string;
  lineWidth?: string;
  lines?: boolean;
  points?: boolean;
  fill?: boolean;
  fillOpacity?: string;
  label?: string;
  showLabel?: boolean;
  slider?: DesmosSlider;
  title?: string;
  parametricDomain?: { min: string; max: string };
}

export interface DesmosState {
  version: 9;
  graph: {
    viewport: { xmin: number; ymin: number; xmax: number; ymax: number };
  };
  expressions: { list: DesmosExpr[] };
}

const COLORS: Record<string, string> = {
  point:   '#2d70b3',
  circle:  '#c74440',
  line:    '#388c46',
  points:  '#6042a6',
  curve:   '#6042a6',
  region:  '#c74440',
  polygon: '#fa7e19',
  segment: '#388c46',
};

const MATH_FNS: Record<string, string> = {
  sin:    '\\sin',    cos:    '\\cos',    tan:    '\\tan',
  arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan',
  ln:     '\\ln',     log:    '\\log',    exp:    '\\exp',
  min:    '\\min',    max:    '\\max',
  floor:  '\\operatorname{floor}',
  ceil:   '\\operatorname{ceil}',
  round:  '\\operatorname{round}',
  sign:   '\\operatorname{sign}',
  mod:    '\\operatorname{mod}',
};

const GREEK: Record<string, string> = {
  alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta',
  epsilon: '\\epsilon', zeta: '\\zeta', eta: '\\eta', theta: '\\theta',
  iota: '\\iota', kappa: '\\kappa', lambda: '\\lambda', mu: '\\mu',
  nu: '\\nu', xi: '\\xi', pi: '\\pi', rho: '\\rho', sigma: '\\sigma',
  tau: '\\tau', upsilon: '\\upsilon', phi: '\\phi', chi: '\\chi',
  psi: '\\psi', omega: '\\omega',
};

export function nameToLatex(name: string): string {
  // internal expr block names pass through as-is (they'll never reach the graph)
  if (name.startsWith('__expr_')) return name;

  const uscore = name.indexOf('_');
  if (uscore !== -1) {
    const prefix = name.slice(0, uscore);
    const suffix = name.slice(uscore + 1).replace(/_/g, '');
    const base = GREEK[prefix] ?? (prefix.length === 1 ? prefix : prefix[0]);
    return suffix ? `${base}_{${suffix}}` : base;
  }
  if (name.length === 1) return name;
  if (GREEK[name]) return GREEK[name];
  return `${name[0]}_{${name.slice(1)}}`;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toPrecision(15).replace(/\.?0+$/, '');
}

const PREC: Record<string, number> = {
  '+': 1, '-': 1, '*': 2, '/': 2, '^': 3, unary: 4,
};

function needsParens(childOp: string, parentOp: string, side: 'left' | 'right'): boolean {
  const cp = PREC[childOp] ?? 0;
  const pp = PREC[parentOp] ?? 0;
  if (cp < pp) return true;
  if (cp === pp && side === 'right' && (parentOp === '-' || parentOp === '/')) return true;
  return false;
}

export class Codegen {
  private list: DesmosExpr[] = [];
  private idCounts = new Map<string, number>();

  generate(program: T.Program): DesmosState {
    for (const stmt of program.body) this.genStmt(stmt);
    return {
      version: 9,
      graph: { viewport: { xmin: -10, ymin: -10, xmax: 10, ymax: 10 } },
      expressions: { list: this.list },
    };
  }

  // stable id derived from a logical name
  private stableId(base: string): string {
    const n = (this.idCounts.get(base) ?? 0) + 1;
    this.idCounts.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  }

  private emit(partial: Omit<DesmosExpr, 'id'>, idBase?: string): string {
    const id = idBase ? this.stableId(idBase) : this.stableId(`__anon_${this.list.length}`);
    this.list.push({ ...partial, id });
    return id;
  }

  private genStmt(stmt: T.Statement): void {
    switch (stmt.type) {
      case 'VarDecl':     this.genVarDecl(stmt);     break;
      case 'AliasDecl':   this.genAliasDecl(stmt);   break;
      case 'PointDecl':   this.genPointDecl(stmt);   break;
      case 'CircleDecl':  this.genCircleDecl(stmt);  break;
      case 'LineDecl':    this.genLineDecl(stmt);    break;
      case 'CurveDecl':   this.genCurveDecl(stmt);   break;
      case 'RegionDecl':  this.genRegionDecl(stmt);  break;
      case 'PolygonDecl': this.genPolygonDecl(stmt); break;
      case 'SegmentDecl': this.genSegmentDecl(stmt); break;
      case 'TextDecl':    this.genTextDecl(stmt);    break;
      case 'GroupDecl':   this.genGroupDecl(stmt);   break;
      case 'SpiralDecl':  this.genSpiralDecl(stmt);  break;
      case 'WaveDecl':    this.genWaveDecl(stmt);    break;
      case 'GridDecl':    this.genGridDecl(stmt);    break;
      case 'FnDecl':      this.genFnDecl(stmt);      break;
      // DebugDecl and ExprBlockDecl are stripped in optimizer; VarDecl handles ExprBlock lowered form
    }
  }

  private genVarDecl(stmt: T.VarDecl): void {
    const varName = nameToLatex(stmt.name);

    // slider
    if (stmt.value.type === 'Call' && stmt.value.fn === 'slider') {
      const [valArg, minArg, maxArg] = stmt.value.args;
      const kw = stmt.value.kwargs ?? {};

      const speedExpr = kw['speed'] ?? stmt.value.args[3];
      const period = (speedExpr?.type === 'NumLit' && speedExpr.value !== 0)
        ? Math.round(1000 / speedExpr.value)
        : undefined;

      const looping = kw['loop'] !== undefined;

      const slider: DesmosSlider = {
        min: minArg ? this.toLaTeX(minArg) : undefined,
        max: maxArg ? this.toLaTeX(maxArg) : undefined,
        hardMin: minArg !== undefined,
        hardMax: maxArg !== undefined,
      };

      if (kw['step']) slider.step = this.toLaTeX(kw['step']);

      if (period !== undefined || looping) {
        slider.isPlaying = true;
        slider.loopMode = 'LOOP_FORWARD';
        if (period !== undefined) slider.animationPeriod = period;
      }

      const initVal = valArg ? this.toLaTeX(valArg) : '0';
      this.emit({ type: 'expression', latex: `${varName}=${initVal}`, slider }, stmt.name);
      return;
    }

    // expr block lowered form — emit bare expression without name binding
    if (stmt.name.startsWith('__expr_')) {
      this.emit({ type: 'expression', latex: this.toLaTeX(stmt.value) }, stmt.name);
      return;
    }

    // domain restriction: y = x^2 domain x > 0  →  y=x^{2}\left\{x>0\right\}
    if (stmt.domain) {
      const exprLatex   = this.toLaTeX(stmt.value);
      const domainLatex = this.toLaTeX(stmt.domain);
      this.emit({ type: 'expression', latex: `${varName}=${exprLatex}\\left\\{${domainLatex}\\right\\}` }, stmt.name);
      return;
    }

    this.emit({ type: 'expression', latex: `${varName}=${this.toLaTeX(stmt.value)}` }, stmt.name);
  }

  /** alias r = expr — identical output to VarDecl */
  private genAliasDecl(stmt: T.AliasDecl): void {
    const varName = nameToLatex(stmt.name);
    this.emit({ type: 'expression', latex: `${varName}=${this.toLaTeX(stmt.value)}` }, stmt.name);
  }

  private genPointDecl(stmt: T.PointDecl): void {
    const color = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? COLORS.point;
    const varName = nameToLatex(stmt.name);
    const tx = this.toLaTeX(stmt.x);
    const ty = this.toLaTeX(stmt.y);
    const partial: Omit<DesmosExpr, 'id'> = {
      type: 'expression',
      latex: `${varName}=\\left(${tx},${ty}\\right)`,
      color, showLabel: true, label: stmt.name,
    };
    if (stmt.style?.pointSize) partial.pointSize = String(stmt.style.pointSize);
    this.emit(partial, stmt.name);
  }

  private genCircleDecl(stmt: T.CircleDecl): void {
    const color = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? COLORS.circle;
    const cx = this.toLaTeX(stmt.cx);
    const cy = this.toLaTeX(stmt.cy);
    const r  = this.toLaTeX(stmt.r);
    const fillOpacity = stmt.style?.opacity !== undefined ? String(stmt.style.opacity) : '0.1';
    this.emit({
      type: 'expression',
      latex: this.circleLatex(cx, cy, r),
      color, fill: true, fillOpacity,
    }, stmt.name);
  }

  private genLineDecl(stmt: T.LineDecl): void {
    const color = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? COLORS.line;
    let latex: string;

    if (stmt.form === 'slope-intercept') {
      const m = stmt.slope ? this.toLaTeX(stmt.slope) : '1';
      const b = stmt.intercept ? this.toLaTeX(stmt.intercept) : '0';
      const mPart = m === '1' ? '' : m === '-1' ? '-' : /[+\-]/.test(m.slice(1)) ? `\\left(${m}\\right)` : m;
      latex = b === '0' ? `y=${mPart}x` : `y=${mPart}x+${b}`;
    } else if (stmt.form === 'standard') {
      const lhs = stmt.lhs ? this.toLaTeX(stmt.lhs) : 'y';
      const rhs = stmt.rhs ? this.toLaTeX(stmt.rhs) : '0';
      latex = `${lhs}=${rhs}`;
    } else {
      latex = stmt.expr ? this.toLaTeX(stmt.expr) : 'y=x';
    }

    const partial: Omit<DesmosExpr, 'id'> = { type: 'expression', latex, color };
    this.applyLineStyle(partial, stmt.style);
    this.emit(partial, stmt.name);
  }

  private genCurveDecl(stmt: T.CurveDecl): void {
    const grad = stmt.style?.gradient;
    const color = grad
      ? (resolveColor(grad.from) ?? COLORS.curve)
      : ((stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? COLORS.curve);
    const fillOpacity = stmt.style?.opacity !== undefined ? String(stmt.style.opacity) : undefined;

    const bodyLatex  = this.toLaTeX(stmt.body);
    const startLatex = this.toLaTeX(stmt.start);
    const endLatex   = this.toLaTeX(stmt.end);
    const stepLatex  = stmt.step ? this.toLaTeX(stmt.step) : undefined;
    const varLtx     = nameToLatex(stmt.var);

    if (stmt.body.type === 'Tuple') {
      const partial: Omit<DesmosExpr, 'id'> = {
        type: 'expression',
        latex: bodyLatex,
        color,
        parametricDomain: { min: startLatex, max: endLatex },
      };
      if (grad) {
        const cl = gradientColorLatex(grad.from, grad.to, varLtx, startLatex, endLatex);
        if (cl) partial.colorLatex = cl;
      }
      if (fillOpacity) { partial.fill = true; partial.fillOpacity = fillOpacity; }
      this.applyLineStyle(partial, stmt.style);
      this.emit(partial, stmt.name);
      return;
    }

    const rangeLatex = stepLatex
      ? `\\left[${startLatex},${stepLatex},...,${endLatex}\\right]`
      : `\\left[${startLatex},...,${endLatex}\\right]`;
    const listLatex = `\\left[${bodyLatex}\\operatorname{for}${varLtx}=${rangeLatex}\\right]`;
    const partial: Omit<DesmosExpr, 'id'> = {
      type: 'expression', latex: listLatex, color, points: true, lines: false,
    };
    if (grad) {
      const gradListLatex = `\\left[${
        gradientColorLatex(grad.from, grad.to, varLtx, startLatex, endLatex)
      }\\operatorname{for}${varLtx}=${rangeLatex}\\right]`;
      partial.colorLatex = gradListLatex;
    }
    this.applyLineStyle(partial, stmt.style);
    this.emit(partial, stmt.name);
  }

  private genRegionDecl(stmt: T.RegionDecl): void {
    const color = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? COLORS.region;
    const fillOpacity = stmt.style?.opacity !== undefined ? String(stmt.style.opacity) : '0.4';
    this.emit({
      type: 'expression',
      latex: this.toLaTeX(stmt.expr),
      color, fill: stmt.style?.fill !== false,
      fillOpacity,
    }, stmt.name);
  }

  private genPolygonDecl(stmt: T.PolygonDecl): void {
    const color = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? COLORS.polygon;
    const pts = stmt.points.map(p => `\\left(${this.toLaTeX(p.x)},${this.toLaTeX(p.y)}\\right)`).join(',');
    const latex = `\\operatorname{polygon}\\left(${pts}\\right)`;
    const fillOpacity = stmt.style?.opacity !== undefined ? String(stmt.style.opacity) : '0.2';
    this.emit({ type: 'expression', latex, color, fill: true, fillOpacity }, stmt.name);
  }

  private genSegmentDecl(stmt: T.SegmentDecl): void {
    const color = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? COLORS.segment;
    const x1 = this.toLaTeX(stmt.p1.x), y1 = this.toLaTeX(stmt.p1.y);
    const x2 = this.toLaTeX(stmt.p2.x), y2 = this.toLaTeX(stmt.p2.y);
    const latex = `\\left[\\left(${x1},${y1}\\right),\\left(${x2},${y2}\\right)\\right]`;
    const partial: Omit<DesmosExpr, 'id'> = { type: 'expression', latex, color, lines: true, points: false };
    this.applyLineStyle(partial, stmt.style);
    this.emit(partial, stmt.name);
  }

  private genTextDecl(stmt: T.TextDecl): void {
    const tx = this.toLaTeX(stmt.x);
    const ty = this.toLaTeX(stmt.y);
    const varName = nameToLatex(stmt.name);
    this.emit({
      type: 'expression',
      latex: `${varName}=\\left(${tx},${ty}\\right)`,
      label: stmt.content,
      showLabel: true,
      points: false,
    }, stmt.name);
  }

  private genFnDecl(stmt: T.FnDecl): void {
    const name = nameToLatex(stmt.name);
    const params = stmt.params.map(nameToLatex).join(',');
    const body = this.toLaTeX(stmt.body);
    this.emit({ type: 'expression', latex: `${name}\\left(${params}\\right)=${body}` }, stmt.name);
  }

  private genGroupDecl(stmt: T.GroupDecl): void {
    this.emit({ type: 'folder', title: stmt.label }, `grp_${stmt.name}`);
  }

  private applyLineStyle(partial: Omit<DesmosExpr, 'id'>, style?: T.StyleBlock): void {
    if (style?.lineWidth !== undefined) partial.lineWidth = String(style.lineWidth);
    if (style?.lineOpacity !== undefined) partial.lineOpacity = String(style.lineOpacity);
  }

  private genSpiralDecl(stmt: T.SpiralDecl): void {
    const color = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? '#6042a6';
    const turns   = this.toLaTeX(stmt.turns);
    const spacing = this.toLaTeX(stmt.spacing);
    const cx      = stmt.cx     ? this.toLaTeX(stmt.cx)     : '0';
    const cy      = stmt.cy     ? this.toLaTeX(stmt.cy)     : '0';
    const rotate  = stmt.rotate ? this.toLaTeX(stmt.rotate) : '0';
    const tVar    = nameToLatex(`t_${stmt.name}`);
    const end     = `${turns}\\cdot 2\\pi`;
    const rx      = `${tVar}\\cdot\\left(${spacing}\\right)\\cdot\\cos\\left(${tVar}+\\left(${rotate}\\right)\\right)`;
    const ry      = `${tVar}\\cdot\\left(${spacing}\\right)\\cdot\\sin\\left(${tVar}+\\left(${rotate}\\right)\\right)`;
    const xExpr   = cx === '0' ? rx : `${cx}+${rx}`;
    const yExpr   = cy === '0' ? ry : `${cy}+${ry}`;
    const latex   = `\\left(${xExpr},${yExpr}\\right)`;
    const partial: Omit<DesmosExpr, 'id'> = {
      type: 'expression', latex, color,
      parametricDomain: { min: '0', max: end },
    };
    const grad = stmt.style?.gradient;
    if (grad) {
      const cl = gradientColorLatex(grad.from, grad.to, tVar, '0', end);
      if (cl) partial.colorLatex = cl;
    }
    this.applyLineStyle(partial, stmt.style);
    this.emit(partial, stmt.name);
  }

  private genWaveDecl(stmt: T.WaveDecl): void {
    const color  = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? '#2d70b3';
    const freq   = this.toLaTeX(stmt.freq);
    const amp    = this.toLaTeX(stmt.amp);
    const phase  = stmt.phase ? this.toLaTeX(stmt.phase) : '0';
    const cx     = stmt.cx   ? this.toLaTeX(stmt.cx)   : '0';
    const cy     = stmt.cy   ? this.toLaTeX(stmt.cy)   : '0';
    const xmin   = stmt.xmin ? this.toLaTeX(stmt.xmin) : '-10';
    const xmax   = stmt.xmax ? this.toLaTeX(stmt.xmax) : '10';
    const tVar   = nameToLatex(`t_${stmt.name}`);
    const yBody  = `\\left(${amp}\\right)\\cdot\\sin\\left(\\left(${freq}\\right)\\cdot${tVar}+\\left(${phase}\\right)\\right)`;
    const xExpr  = cx === '0' ? tVar : `${tVar}+\\left(${cx}\\right)`;
    const yExpr  = cy === '0' ? yBody : `${yBody}+\\left(${cy}\\right)`;
    const latex  = `\\left(${xExpr},${yExpr}\\right)`;
    const partial: Omit<DesmosExpr, 'id'> = {
      type: 'expression', latex, color,
      parametricDomain: { min: xmin, max: xmax },
    };
    const grad = stmt.style?.gradient;
    if (grad) {
      const cl = gradientColorLatex(grad.from, grad.to, tVar, xmin, xmax);
      if (cl) partial.colorLatex = cl;
    }
    this.applyLineStyle(partial, stmt.style);
    this.emit(partial, stmt.name);
  }

  private genGridDecl(stmt: T.GridDecl): void {
    const color      = (stmt.style?.color ? resolveColor(stmt.style.color) : null) ?? '#888888';
    const lineOpacity = stmt.style?.lineOpacity ?? stmt.style?.opacity ?? 0.4;
    const cols = stmt.cols.type === 'NumLit' ? stmt.cols.value : 10;
    const rows = stmt.rows.type === 'NumLit' ? stmt.rows.value : 10;
    const xmin = stmt.xmin?.type === 'NumLit' ? stmt.xmin.value : -(cols / 2);
    const xmax = stmt.xmax?.type === 'NumLit' ? stmt.xmax.value : (cols / 2);
    const ymin = stmt.ymin?.type === 'NumLit' ? stmt.ymin.value : -(rows / 2);
    const ymax = stmt.ymax?.type === 'NumLit' ? stmt.ymax.value : (rows / 2);
    const buildList = (lo: number, hi: number): string => {
      const vals: string[] = [];
      for (let v = lo; v <= hi; v++) vals.push(fmtNum(v));
      return `\\left[${vals.join(',')}\\right]`;
    };
    const xList = buildList(Math.ceil(xmin), Math.floor(xmax));
    const yList = buildList(Math.ceil(ymin), Math.floor(ymax));
    const lw = stmt.style?.lineWidth !== undefined ? String(stmt.style.lineWidth) : '1';
    this.emit({ type: 'expression', latex: `y=${yList}`, color, lineOpacity: String(lineOpacity), lineWidth: lw }, `${stmt.name}_h`);
    this.emit({ type: 'expression', latex: `x=${xList}`, color, lineOpacity: String(lineOpacity), lineWidth: lw }, `${stmt.name}_v`);
  }

  private circleLatex(cx: string, cy: string, r: string): string {
    const hPart = cx === '0' ? 'x^{2}' : `\\left(x-\\left(${cx}\\right)\\right)^{2}`;
    const kPart = cy === '0' ? 'y^{2}' : `\\left(y-\\left(${cy}\\right)\\right)^{2}`;
    const rPart = r  === '1' ? '1'     : `\\left(${r}\\right)^{2}`;
    return `${hPart}+${kPart}=${rPart}`;
  }

  private mapToLatex(map: T.MapExpr): string {
    const varLtx = nameToLatex(map.var);
    const body   = this.toLaTeX(map.body);
    const range  = this.rangeToLatex(map.range);
    return `\\left[${body}\\operatorname{for}${varLtx}=${range}\\right]`;
  }

  private rangeToLatex(range: T.ListRange): string {
    const start = this.toLaTeX(range.start);
    const end   = this.toLaTeX(range.end);
    if (range.step) {
      const step = this.toLaTeX(range.step);
      return `\\left[${start},${step},...,${end}\\right]`;
    }
    return `\\left[${start},...,${end}\\right]`;
  }

  toLaTeX(expr: T.Expr): string {
    switch (expr.type) {
      case 'NumLit':    return fmtNum(expr.value);
      case 'StringLit': return expr.value;
      case 'Ident':     return nameToLatex(expr.name);

      case 'UnaryOp':
        return `-${this.wrap(expr.operand, 'unary', 'left')}`;

      case 'BinOp': {
        const { op, left, right } = expr;
        const l = this.wrap(left,  op, 'left');
        const r = this.wrap(right, op, 'right');
        switch (op) {
          case '+': return `${l}+${r}`;
          case '-': return `${l}-${r}`;
          case '*': return `${l}\\cdot ${r}`;
          case '/': return `\\frac{${this.toLaTeX(left)}}{${this.toLaTeX(right)}}`;
          case '^': return `${l}^{${this.toLaTeX(right)}}`;
          default:  return `${l}${op}${r}`;
        }
      }

      case 'CompareExpr': {
        const l = this.toLaTeX(expr.left);
        const r = this.toLaTeX(expr.right);
        const opMap: Record<T.CompareOp, string> = {
          '>':  '>',
          '<':  '<',
          '>=': '\\ge ',
          '<=': '\\le ',
          '!=': '\\ne ',
          '==': '=',
        };
        return `${l}${opMap[expr.op]}${r}`;
      }

      case 'ConditionalExpr': {
        const cond  = this.toLaTeX(expr.cond);
        const then  = this.toLaTeX(expr.then);
        const else_ = this.toLaTeX(expr.else_);
        return `\\left\\{${cond}:${then},${else_}\\right\\}`;
      }

      case 'PiecewiseExpr': {
        const parts = expr.branches.map(b => {
          if (b.cond === null) return this.toLaTeX(b.body);
          return `${this.toLaTeX(b.cond)}:${this.toLaTeX(b.body)}`;
        });
        return `\\left\\{${parts.join(',')}\\right\\}`;
      }

      case 'Call': return this.callToLatex(expr);

      case 'Tuple':
        return `\\left(${this.toLaTeX(expr.x)},${this.toLaTeX(expr.y)}\\right)`;

      case 'ListRange':
        return this.rangeToLatex(expr);

      case 'MapExpr':
        return this.mapToLatex(expr);

      case 'ForExpr': {
        const body  = this.toLaTeX(expr.body);
        const start = this.toLaTeX(expr.start);
        const end   = this.toLaTeX(expr.end);
        const rangeLatex = expr.step
          ? `\\left[${start},${this.toLaTeX(expr.step)},...,${end}\\right]`
          : `\\left[${start},...,${end}\\right]`;
        return `\\left[${body}\\operatorname{for}${nameToLatex(expr.var)}=${rangeLatex}\\right]`;
      }
    }
  }

  private callToLatex(call: T.Call): string {
    const args = call.args.map(a => this.toLaTeX(a));

    if (call.fn === 'sqrt') return `\\sqrt{${args[0] ?? '0'}}`;
    if (call.fn === 'abs')  return `\\left|${args[0] ?? '0'}\\right|`;
    if (call.fn === 'project') return args[0] ?? '0';

    const latexFn = MATH_FNS[call.fn];
    if (latexFn) return `${latexFn}\\left(${args.join(',')}\\right)`;

    return `${nameToLatex(call.fn)}\\left(${args.join(',')}\\right)`;
  }

  private wrap(expr: T.Expr, parentOp: string, side: 'left' | 'right'): string {
    const latex = this.toLaTeX(expr);
    const requiresParens =
      (expr.type === 'BinOp'   && needsParens(expr.op, parentOp, side)) ||
      (expr.type === 'UnaryOp' && (parentOp === '^' || parentOp === '*'));
    return requiresParens ? `\\left(${latex}\\right)` : latex;
  }
}

export function codegen(program: T.Program): DesmosState {
  return new Codegen().generate(program);
}
