// code generator to desmos expre JSON

import * as T from './types';

const DESMOS_NAMED: Record<string, string> = {
  red: '#c74440', blue: '#2d70b3', green: '#388c46',
  orange: '#fa7e19', purple: '#6042a6', black: '#000000', white: '#ffffff',
};

function clamp(v: number, lo: number, hi: number): number {
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
  if (expr.type === 'Ident' && DESMOS_NAMED[expr.name]) return DESMOS_NAMED[expr.name];
  if (expr.type !== 'Call') return null;
  const nums = expr.args.every(a => a.type === 'NumLit');
  if (!nums) return null;
  const [a0 = 0, a1 = 0, a2 = 0] = (expr.args as T.NumLit[]).map(a => a.value);
  if (expr.fn === 'rgb') return rgbToHex(a0, a1, a2);
  if (expr.fn === 'hsv') { const [r, g, b] = hsvToRgb(a0, a1, a2); return rgbToHex(r, g, b); }
  return null;
}

// output types

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
  lineOpacity?: string;
  pointOpacity?: string;
  pointSize?: string;
  lines?: boolean;
  points?: boolean;
  fill?: boolean;
  fillOpacity?: string;
  label?: string;
  showLabel?: boolean;
  slider?: DesmosSlider;
}

export interface DesmosState {
  version: 9;
  graph: {
    viewport: { xmin: number; ymin: number; xmax: number; ymax: number };
  };
  expressions: { list: DesmosExpr[] };
}

// color palette

const COLORS: Record<string, string> = {
  point:  '#2d70b3',
  circle: '#c74440',
  line:   '#388c46',
  points: '#6042a6',
};

// math function to LaTeX cmd map

const MATH_FNS: Record<string, string> = {
  sin:    '\\sin',    cos:    '\\cos',    tan:    '\\tan',
  arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan',
  ln:     '\\ln',     log:    '\\log',
  min:    '\\min',    max:    '\\max',
  floor:  '\\operatorname{floor}',
  ceil:   '\\operatorname{ceil}',
  round:  '\\operatorname{round}',
  sign:   '\\operatorname{sign}',
  mod:    '\\operatorname{mod}',
};

// operator precedence (for paren elision)

const PREC: Record<string, number> = {
  '+': 1, '-': 1, '*': 2, '/': 2, '^': 3, unary: 4,
};

function needsParens(childOp: string, parentOp: string, side: 'left' | 'right'): boolean {
  const cp = PREC[childOp] ?? 0;
  const pp = PREC[parentOp] ?? 0;
  if (cp < pp) return true;
  // e.g. (a - b) - c is fine, but a - (b - c) is not
  if (cp === pp && side === 'right' && (parentOp === '-' || parentOp === '/')) return true;
  return false;
}

// name to Desmos LaTeX identifier
//
//   single char     to  used as-is:  x  t  r
//   greek name      to  \alpha  \beta  \theta  …
//   multi-char      →to first letter + subscript:  wave → w_{ave}

const GREEK: Record<string, string> = {
  alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta',
  epsilon: '\\epsilon', zeta: '\\zeta', eta: '\\eta', theta: '\\theta',
  iota: '\\iota', kappa: '\\kappa', lambda: '\\lambda', mu: '\\mu',
  nu: '\\nu', xi: '\\xi', pi: '\\pi', rho: '\\rho', sigma: '\\sigma',
  tau: '\\tau', upsilon: '\\upsilon', phi: '\\phi', chi: '\\chi',
  psi: '\\psi', omega: '\\omega',
};

export function nameToLatex(name: string): string {
  if (name.length === 1) return name;
  if (GREEK[name])       return GREEK[name];
  return `${name[0]}_{${name.slice(1)}}`;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}


export class Codegen {
  private list: DesmosExpr[] = [];
  private idCounter = 1;
  private latexCache = new Map<string, string>(); // latex → id (dedup)

  generate(program: T.Program): DesmosState {
    for (const stmt of program.body) {
      this.genStmt(stmt);
    }
    return {
      version: 9,
      graph: { viewport: { xmin: -10, ymin: -10, xmax: 10, ymax: 10 } },
      expressions: { list: this.list },
    };
  }


  private emit(partial: Omit<DesmosExpr, 'id'>): string {
    const key = partial.latex ?? '';
    if (key && this.latexCache.has(key)) {
      return this.latexCache.get(key)!; // dedup identical expressions
    }
    const id = String(this.idCounter++);
    const full: DesmosExpr = { ...partial, id };
    this.list.push(full);
    if (key) this.latexCache.set(key, id);
    return id;
  }

  // stmt dispatch

  private genStmt(stmt: T.Statement): void {
    switch (stmt.type) {
      case 'LetDecl':    this.genLetDecl(stmt);    break;
      case 'EntityDecl': this.genEntityDecl(stmt); break;
      case 'ListDecl':   this.genListDecl(stmt);   break;
      // FnDecl is eliminated by the optimizer
    }
  }

  // let declarations

  private genLetDecl(stmt: T.LetDecl): void {
    if (stmt.value.type === 'Call' && stmt.value.fn === 'time') {
      const [startArg, endArg, speedArg] = stmt.value.args;
      const varName = nameToLatex(stmt.name);
      const minVal  = startArg ? this.toLaTeX(startArg) : '0';
      const maxVal  = endArg   ? this.toLaTeX(endArg)   : '10';
      const period  = speedArg
        ? Math.round(1000 / parseFloat(this.toLaTeX(speedArg)))
        : 4000;
      this.emit({
        type: 'expression',
        latex: `${varName}=0`,
        slider: {
          min: minVal, max: maxVal,
          hardMin: true, hardMax: true,
          isPlaying: true,
          animationPeriod: period,
        },
      });
      return;
    }

    const varName = nameToLatex(stmt.name);
    const value   = this.toLaTeX(stmt.value);
    if (stmt.domain) {
      const { min, max, animMethod, loopDir } = stmt.domain;
      const slider: DesmosSlider = {
        min: this.toLaTeX(min),
        max: this.toLaTeX(max),
        hardMin: true,
        hardMax: true,
      };
      if (animMethod === 'play') {
        slider.isPlaying = true;
        slider.loopMode = 'PLAY_ONCE';
        slider.animationPeriod = 4000;
      } else if (animMethod === 'loop') {
        slider.isPlaying = true;
        slider.loopMode = loopDir === -1 ? 'LOOP_BACKWARD' : 'LOOP_FORWARD';
        slider.animationPeriod = 4000;
      }
      this.emit({ type: 'expression', latex: `${varName}=${value}`, slider });
      return;
    }
    this.emit({ type: 'expression', latex: `${varName}=${value}` });
  }


  private genEntityDecl(stmt: T.EntityDecl): void {
    const color = resolveColor(stmt.props['color']) ?? COLORS[stmt.kind];
    switch (stmt.kind) {
      case 'point': this.genPoint(stmt, color); break;
      case 'circle': this.genCircle(stmt, color); break;
      case 'line':   this.genLine(stmt, color);   break;
    }
  }

  private genPoint(stmt: T.EntityDecl, color: string): void {
    let tx = '0', ty = '0';
    const center = stmt.props['center'];
    if (center?.type === 'Tuple') {
      tx = this.toLaTeX(center.x);
      ty = this.toLaTeX(center.y);
    } else {
      tx = stmt.props['x'] ? this.toLaTeX(stmt.props['x']) : '0';
      ty = stmt.props['y'] ? this.toLaTeX(stmt.props['y']) : '0';
    }
    const varName = nameToLatex(stmt.name);
    this.emit({
      type: 'expression',
      latex: `${varName}=\\left(${tx},${ty}\\right)`,
      color,
      showLabel: true,
      label: stmt.name,
    });
  }

  private genCircle(stmt: T.EntityDecl, color: string): void {
    let cx = '0', cy = '0', r = '1';
    const center = stmt.props['center'];
    const radius = stmt.props['radius'];
    if (center?.type === 'Tuple') {
      cx = this.toLaTeX(center.x);
      cy = this.toLaTeX(center.y);
    }
    if (radius) r = this.toLaTeX(radius);

    const hPart = cx === '0' ? 'x^{2}' : `\\left(x-${cx}\\right)^{2}`;
    const kPart = cy === '0' ? 'y^{2}' : `\\left(y-${cy}\\right)^{2}`;
    const rPart = r  === '1' ? '1'     : `\\left(${r}\\right)^{2}`;

    this.emit({
      type: 'expression',
      latex: `${hPart}+${kPart}=${rPart}`,
      color,
      fill: true,
      fillOpacity: '0.1',
    });
  }

  private genLine(stmt: T.EntityDecl, color: string): void {
    const latex = this.buildLineLatex(stmt.props);
    this.emit({ type: 'expression', latex, color });
  }

  private buildLineLatex(props: Record<string, T.Expr>): string {
    if (props['slope'] && props['intercept']) {
      const m = this.toLaTeX(props['slope']);
      const b = this.toLaTeX(props['intercept']);
      const mPart = m === '1' ? '' : m === '-1' ? '-' : m;
      return b === '0' ? `y=${mPart}x` : `y=${mPart}x+${b}`;
    }
    if (props['point1'] && props['point2']) {
      const p1 = props['point1'], p2 = props['point2'];
      if (p1.type === 'Tuple' && p2.type === 'Tuple') {
        const x1 = this.toLaTeX(p1.x), y1 = this.toLaTeX(p1.y);
        const x2 = this.toLaTeX(p2.x), y2 = this.toLaTeX(p2.y);
        return `y-${y1}=\\frac{${y2}-${y1}}{${x2}-${x1}}\\left(x-${x1}\\right)`;
      }
    }
    if (props['y']) return `y=${this.toLaTeX(props['y'])}`;
    if (props['x']) return `x=${this.toLaTeX(props['x'])}`;
    return 'y=x';
  }

  // pt lists

  private genListDecl(stmt: T.ListDecl): void {
    const varName = nameToLatex(stmt.name);
    const latex   = this.mapToLatex(stmt.map);
    this.emit({
      type: 'expression',
      latex: `${varName}=${latex}`,
      color: COLORS.points,
      points: true,
      lines: false,
    });
  }

  // LaTeX emitters

  private mapToLatex(map: T.MapExpr): string {
    const body  = this.toLaTeX(map.body);
    const range = this.rangeToLatex(map.range);
    return `\\left[${body}\\operatorname{for}${map.var}=${range}\\right]`;
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

  // central LaTeX emitter for expres
  toLaTeX(expr: T.Expr): string {
    switch (expr.type) {
      case 'NumLit': return fmtNum(expr.value);
      case 'Ident':  return nameToLatex(expr.name);

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

      case 'Call': return this.callToLatex(expr);

      case 'Tuple':
        return `\\left(${this.toLaTeX(expr.x)},${this.toLaTeX(expr.y)}\\right)`;

      case 'ListRange':
        return this.rangeToLatex(expr);

      case 'MapExpr':
        return this.mapToLatex(expr);

    }
  }

  private callToLatex(call: T.Call): string {
    const args = call.args.map(a => this.toLaTeX(a));

    if (call.fn === 'sqrt') return `\\sqrt{${args[0] ?? '0'}}`;
    if (call.fn === 'abs')  return `\\left|${args[0] ?? '0'}\\right|`;

    // project() stub — emit the vector argument unchanged
    if (call.fn === 'project') return args[0] ?? '0';

    const latexFn = MATH_FNS[call.fn];
    if (latexFn) return `${latexFn}\\left(${args.join(',')}\\right)`;

    // user-defined function (should be inlined, but emit as fallback)
    return `${nameToLatex(call.fn)}\\left(${args.join(',')}\\right)`;
  }

  // wrap child in parens if its precedence is lower than parent's
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
