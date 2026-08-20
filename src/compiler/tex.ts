// inverse of codegen for print

import * as T from './types';
import { nameToLatex, resolveColor } from './codegen';

export interface TexViewport {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface TexOptions {
  title?: string;
  viewport?: TexViewport;
  samples?: number;
}

export interface TexSkip {
  name: string;
  reason: string;
}

export interface TexResult {
  tex: string;
  skipped: TexSkip[];
}

const DEFAULT_VIEWPORT: TexViewport = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
const DEFAULT_SAMPLES = 200;

const COLORS: Record<string, string> = {
  point: '#2d70b3',
  circle: '#c74440',
  line: '#388c46',
  curve: '#6042a6',
  polygon: '#fa7e19',
  segment: '#388c46',
  spiral: '#6042a6',
  wave: '#2d70b3',
  grid: '#888888',
};

const PGF_FNS: Record<string, (args: string[]) => string> = {
  sin: a => `sin(deg(${a[0]}))`,
  cos: a => `cos(deg(${a[0]}))`,
  tan: a => `tan(deg(${a[0]}))`,
  arcsin: a => `rad(asin(${a[0]}))`,
  arccos: a => `rad(acos(${a[0]}))`,
  arctan: a => `rad(atan(${a[0]}))`,
  ln: a => `ln(${a[0]})`,
  log: a => `log10(${a[0]})`,
  exp: a => `exp(${a[0]})`,
  sqrt: a => `sqrt(${a[0]})`,
  abs: a => `abs(${a[0]})`,
  floor: a => `floor(${a[0]})`,
  ceil: a => `ceil(${a[0]})`,
  round: a => `round(${a[0]})`,
  sign: a => `sign(${a[0]})`,
  mod: a => `mod(${a[0]},${a[1]})`,
  min: a => `min(${a.join(',')})`,
  max: a => `max(${a.join(',')})`,
};

const JS_FNS: Record<string, (args: number[]) => number> = {
  sin: a => Math.sin(a[0]), cos: a => Math.cos(a[0]), tan: a => Math.tan(a[0]),
  arcsin: a => Math.asin(a[0]), arccos: a => Math.acos(a[0]), arctan: a => Math.atan(a[0]),
  ln: a => Math.log(a[0]), log: a => Math.log10(a[0]), exp: a => Math.exp(a[0]),
  sqrt: a => Math.sqrt(a[0]), abs: a => Math.abs(a[0]),
  floor: a => Math.floor(a[0]), ceil: a => Math.ceil(a[0]),
  round: a => Math.round(a[0]), sign: a => Math.sign(a[0]),
  mod: a => a[0] - a[1] * Math.floor(a[0] / a[1]),
  min: a => Math.min(...a), max: a => Math.max(...a),
};

const NAMED_CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };

const COMPARE_OPS: Record<T.CompareOp, string> = {
  '>': '>', '<': '<', '>=': '>=', '<=': '<=', '!=': '!=', '==': '==',
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-4) return n.toExponential(6).replace(/e([+-])(\d+)/, '*10^{$1$2}');
  return String(Number(n.toPrecision(10)));
}

function texEscape(text: string): string {
  return text.replace(/[\\&%$#_{}~^]/g, ch =>
    ch === '\\' ? '\\textbackslash{}'
      : ch === '~' ? '\\textasciitilde{}'
        : ch === '^' ? '\\textasciicircum{}'
          : `\\${ch}`);
}

class TexGen {
  private readonly viewport: TexViewport;
  private readonly samples: number;

  private consts = new Map<string, number>();
  private macros = new Map<string, string>();
  private macroLines: string[] = [];
  private colors = new Map<string, string>();
  private body: string[] = [];
  private skipped: TexSkip[] = [];

  /** dsl name :  pgf token */
  private scope = new Map<string, string>();

  constructor(opts: TexOptions) {
    this.viewport = opts.viewport ?? DEFAULT_VIEWPORT;
    this.samples = opts.samples ?? DEFAULT_SAMPLES;
  }

  generate(program: T.Program, title?: string): TexResult {
    this.collectConsts(program);
    for (const stmt of program.body) this.genStmt(stmt);
    return { tex: this.document(title), skipped: this.skipped };
  }

  private collectConsts(program: T.Program): void {
    for (const stmt of program.body) {
      switch (stmt.type) {
        case 'VarDecl': {
          const slider = stmt.value.type === 'Call' && stmt.value.fn === 'slider'
            ? this.evalConst(stmt.value.args[0])
            : null;
          const value = slider ?? this.evalConst(stmt.value);
          if (value !== null) this.defineConst(stmt.name, value);
          break;
        }
        case 'AliasDecl': {
          const value = this.evalConst(stmt.value);
          if (value !== null) this.defineConst(stmt.name, value);
          break;
        }
        case 'TimeDecl':
          this.defineConst(stmt.name, this.evalConst(stmt.start) ?? 0);
          break;
        case 'CameraDecl': {
          const az = this.evalConst(stmt.azimuth);
          const el = this.evalConst(stmt.elevation);
          if (az !== null) this.defineConst(`${stmt.name}_az`, az);
          if (el !== null) this.defineConst(`${stmt.name}_el`, el);
          break;
        }
      }
    }
  }

  private defineConst(name: string, value: number): void {
    if (this.macros.has(name)) return;
    const letters = name.replace(/[^a-zA-Z]/g, '') || 'v';
    let macro = `\\dsl${letters}`;
    while ([...this.macros.values()].includes(macro)) macro += 'x';
    this.macros.set(name, macro);
    this.consts.set(name, value);
    this.macroLines.push(`\\pgfmathsetmacro{${macro}}{${fmt(value)}}`);
  }

  private color(expr: T.Expr | undefined, fallback: string): string {
    const hex = (expr ? resolveColor(expr) : null) ?? fallback;
    const existing = this.colors.get(hex);
    if (existing) return existing;
    const name = `dslc${this.colors.size + 1}`;
    this.colors.set(hex, name);
    return name;
  }

  private skip(name: string, reason: string): void {
    this.skipped.push({ name, reason });
  }

  // constant folding

  private evalConst(expr: T.Expr | undefined): number | null {
    if (!expr) return null;
    switch (expr.type) {
      case 'NumLit': return expr.value;
      case 'Ident': return this.consts.get(expr.name) ?? NAMED_CONSTS[expr.name] ?? null;
      case 'UnaryOp': {
        const v = this.evalConst(expr.operand);
        return v === null ? null : -v;
      }
      case 'BinOp': {
        const l = this.evalConst(expr.left);
        const r = this.evalConst(expr.right);
        if (l === null || r === null) return null;
        switch (expr.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return r === 0 ? null : l / r;
          case '^': return Math.pow(l, r);
        }
        return null;
      }
      case 'Call': {
        const fn = JS_FNS[expr.fn];
        if (!fn) return null;
        const args: number[] = [];
        for (const a of expr.args) {
          const v = this.evalConst(a);
          if (v === null) return null;
          args.push(v);
        }
        const out = fn(args);
        return Number.isFinite(out) ? out : null;
      }
      default: return null;
    }
  }

  private point(x: T.Expr, y: T.Expr): string | null {
    const px = this.evalConst(x);
    const py = this.evalConst(y);
    return px === null || py === null ? null : `(${fmt(px)},${fmt(py)})`;
  }

  // ast -> pgfmath

  private pgf(expr: T.Expr): string | null {
    switch (expr.type) {
      case 'NumLit': return fmt(expr.value);
      case 'StringLit': return null;

      case 'Ident': {
        const bound = this.scope.get(expr.name);
        if (bound) return bound;
        const macro = this.macros.get(expr.name);
        if (macro) return macro;
        if (NAMED_CONSTS[expr.name] !== undefined) return fmt(NAMED_CONSTS[expr.name]);
        return null;
      }

      case 'UnaryOp': {
        const v = this.pgf(expr.operand);
        return v === null ? null : `(-${v})`;
      }

      case 'BinOp': {
        const l = this.pgf(expr.left);
        const r = this.pgf(expr.right);
        if (l === null || r === null) return null;
        return `(${l}${expr.op}${r})`;
      }

      case 'CompareExpr': {
        const l = this.pgf(expr.left);
        const r = this.pgf(expr.right);
        if (l === null || r === null) return null;
        return `(${l} ${COMPARE_OPS[expr.op]} ${r})`;
      }

      case 'ConditionalExpr': {
        const c = this.pgf(expr.cond);
        const a = this.pgf(expr.then);
        const b = this.pgf(expr.else_);
        if (c === null || a === null || b === null) return null;
        return `(${c} ? ${a} : ${b})`;
      }

      case 'PiecewiseExpr': {
        const fallback = expr.branches.find(b => b.cond === null);
        if (!fallback) return null;
        let out = this.pgf(fallback.body);
        if (out === null) return null;
        const guarded = expr.branches.filter(b => b.cond !== null).reverse();
        for (const branch of guarded) {
          const c = this.pgf(branch.cond!);
          const v = this.pgf(branch.body);
          if (c === null || v === null) return null;
          out = `(${c} ? ${v} : ${out})`;
        }
        return out;
      }

      case 'Call': return this.callToPgf(expr);

      case 'Tuple':
      case 'ListRange':
      case 'MapExpr':
      case 'ForExpr':
        return null;
    }
  }

  private callToPgf(call: T.Call): string | null {
    const args: string[] = [];
    for (const a of call.args) {
      const v = this.pgf(a);
      if (v === null) return null;
      args.push(v);
    }

    const preset = this.presetToPgf(call.fn, args);
    if (preset !== null) return preset;

    const fn = PGF_FNS[call.fn];
    return fn ? fn(args) : null;
  }

  /** scalar anim presets */
  private presetToPgf(fn: string, args: string[]): string | null {
    const u = `(${args[0] ?? '0'})`;
    const second = (fallback: string) => (args[1] !== undefined ? `(${args[1]})` : fallback);
    switch (fn) {
      case 'ease': return `(${u}^2*(3-2*${u}))`;
      case 'pulse': return `(1-abs(2*${u}-1))`;
      case 'bounce': return `abs(sin(deg(pi*${u})))`;
      case 'wobble': return `(${second('1')}*sin(deg(2*pi*${u})))`;
      default: return null;
    }
  }

  private linear(expr: T.Expr): { a: number; b: number; c: number } | null {
    switch (expr.type) {
      case 'NumLit': return { a: 0, b: 0, c: expr.value };
      case 'Ident': {
        if (expr.name === 'x') return { a: 1, b: 0, c: 0 };
        if (expr.name === 'y') return { a: 0, b: 1, c: 0 };
        const v = this.evalConst(expr);
        return v === null ? null : { a: 0, b: 0, c: v };
      }
      case 'UnaryOp': {
        const v = this.linear(expr.operand);
        return v && { a: -v.a, b: -v.b, c: -v.c };
      }
      case 'BinOp': {
        const l = this.linear(expr.left);
        const r = this.linear(expr.right);
        if (!l || !r) return null;
        switch (expr.op) {
          case '+': return { a: l.a + r.a, b: l.b + r.b, c: l.c + r.c };
          case '-': return { a: l.a - r.a, b: l.b - r.b, c: l.c - r.c };
          case '*': {
            if (l.a === 0 && l.b === 0) return { a: l.c * r.a, b: l.c * r.b, c: l.c * r.c };
            if (r.a === 0 && r.b === 0) return { a: r.c * l.a, b: r.c * l.b, c: r.c * l.c };
            return null;
          }
          case '/':
            if (r.a === 0 && r.b === 0 && r.c !== 0) {
              return { a: l.a / r.c, b: l.b / r.c, c: l.c / r.c };
            }
            return null;
          default: return null;
        }
      }
      default: {
        const v = this.evalConst(expr);
        return v === null ? null : { a: 0, b: 0, c: v };
      }
    }
  }

  private domainBounds(expr: T.Expr): { min: number; max: number } | null {
    if (expr.type !== 'CompareExpr') return null;
    const onLeft = expr.left.type === 'Ident' && expr.left.name === 'x';
    const onRight = expr.right.type === 'Ident' && expr.right.name === 'x';
    if (onLeft === onRight) return null;

    const bound = this.evalConst(onLeft ? expr.right : expr.left);
    if (bound === null) return null;

    // `5 > x` is `x < 5`
    const op = onLeft ? expr.op : ({ '>': '<', '<': '>', '>=': '<=', '<=': '>=' } as Record<string, T.CompareOp>)[expr.op] ?? expr.op;
    if (op === '>' || op === '>=') return { min: bound, max: this.viewport.xmax };
    if (op === '<' || op === '<=') return { min: this.viewport.xmin, max: bound };
    return null;
  }

  // statements

  private genStmt(stmt: T.Statement): void {
    switch (stmt.type) {
      case 'VarDecl': this.genVarDecl(stmt); break;
      case 'PointDecl': this.genPoint(stmt); break;
      case 'CircleDecl': this.genCircle(stmt); break;
      case 'LineDecl': this.genLine(stmt); break;
      case 'CurveDecl': this.genCurve(stmt); break;
      case 'PolygonDecl': this.genPolygon(stmt); break;
      case 'SegmentDecl': this.genSegment(stmt); break;
      case 'TextDecl': this.genText(stmt); break;
      case 'SpiralDecl': this.genSpiral(stmt); break;
      case 'WaveDecl': this.genWave(stmt); break;
      case 'GridDecl': this.genGrid(stmt); break;
      case 'RegionDecl':
        this.skip(stmt.name, 'pgfplots does not fill an inequality region');
        break;
    }
  }

  private genVarDecl(stmt: T.VarDecl): void {
    if (this.macros.has(stmt.name)) return;

    // `pts = (cos(t), sin(t)) for t in 0..6.28` is the inline form of `curve`
    if (stmt.value.type === 'ForExpr') {
      this.genSweep(stmt.name, stmt.value.var, stmt.value.start, stmt.value.end, stmt.value.step, stmt.value.body, undefined);
      return;
    }

    // a tuple is a point, the way desmos draws `p = (1, 2)`
    if (stmt.value.type === 'Tuple') {
      const at = this.point(stmt.value.x, stmt.value.y);
      if (at) {
        const color = this.color(undefined, COLORS.point);
        this.body.push(`\\addplot[${color}, only marks, mark=*, mark size=2pt] coordinates {${at}};`);
      }
      return;
    }

    if (stmt.name !== 'y') return;

    this.scope.set('x', 'x');
    const body = this.pgf(stmt.value);
    this.scope.clear();
    if (body === null) {
      this.skip(stmt.name, 'the expression has no pgfmath form');
      return;
    }

    let min = this.viewport.xmin;
    let max = this.viewport.xmax;
    if (stmt.domain) {
      const bounds = this.domainBounds(stmt.domain);
      if (!bounds) {
        this.skip(stmt.name, 'the domain is not a simple bound on x');
        return;
      }
      ({ min, max } = bounds);
    }

    const color = this.color(undefined, COLORS.line);
    this.body.push(
      `\\addplot[${color}, thick, smooth, samples=${this.samples}, domain=${fmt(min)}:${fmt(max)}] {${body}};`,
    );
  }

  private genPoint(stmt: T.PointDecl): void {
    const at = this.point(stmt.x, stmt.y);
    if (!at) {
      this.skip(stmt.name, 'the coordinates are not constant');
      return;
    }
    const color = this.color(stmt.style?.color, COLORS.point);
    const size = stmt.style?.pointSize ? stmt.style.pointSize / 4 : 2;
    this.body.push(`\\addplot[${color}, only marks, mark=*, mark size=${fmt(size)}pt] coordinates {${at}};`);
    this.body.push(`\\node[${color}, anchor=south west] at (axis cs:${at.slice(1, -1)}) {$${nameToLatex(stmt.name)}$};`);
  }

  private genCircle(stmt: T.CircleDecl): void {
    const cx = this.pgf(stmt.cx);
    const cy = this.pgf(stmt.cy);
    const r = this.pgf(stmt.r);
    if (cx === null || cy === null || r === null) {
      this.skip(stmt.name, 'the centre or the radius has no pgfmath form');
      return;
    }
    const color = this.color(stmt.style?.color, COLORS.circle);
    const opacity = stmt.style?.opacity ?? 0.1;
    this.body.push(
      `\\addplot[${color}, thick, fill=${color}, fill opacity=${fmt(opacity)}, samples=${this.samples}, ` +
      `domain=0:360, variable=\\t] ({${cx}+${r}*cos(\\t)}, {${cy}+${r}*sin(\\t)});`,
    );
  }

  private genLine(stmt: T.LineDecl): void {
    const color = this.color(stmt.style?.color, COLORS.line);
    const { xmin, xmax, ymin, ymax } = this.viewport;

    if (stmt.form === 'slope-intercept') {
      const m = stmt.slope ? this.pgf(stmt.slope) : '1';
      const b = stmt.intercept ? this.pgf(stmt.intercept) : '0';
      if (m === null || b === null) {
        this.skip(stmt.name, 'the slope or the intercept has no pgfmath form');
        return;
      }
      this.body.push(
        `\\addplot[${color}, thick, samples=2, domain=${fmt(xmin)}:${fmt(xmax)}] {${m}*x+${b}};`,
      );
      return;
    }

    const expr = stmt.form === 'standard'
      ? (stmt.lhs && stmt.rhs ? { lhs: stmt.lhs, rhs: stmt.rhs } : null)
      : (stmt.expr?.type === 'CompareExpr' && stmt.expr.op === '=='
        ? { lhs: stmt.expr.left, rhs: stmt.expr.right }
        : null);

    if (!expr) {
      this.skip(stmt.name, 'the line is not written as an equation');
      return;
    }

    const lhs = this.linear(expr.lhs);
    const rhs = this.linear(expr.rhs);
    if (!lhs || !rhs) {
      this.skip(stmt.name, 'the equation is not linear in x and y');
      return;
    }

    // a*x + b*y + c = 0
    const a = lhs.a - rhs.a, b = lhs.b - rhs.b, c = lhs.c - rhs.c;
    if (b !== 0) {
      const slope = -a / b;
      const intercept = -c / b;
      this.body.push(
        `\\addplot[${color}, thick, samples=2, domain=${fmt(xmin)}:${fmt(xmax)}] ` +
        `{${fmt(slope)}*x+${fmt(intercept)}};`,
      );
      return;
    }
    if (a !== 0) {
      const at = -c / a;
      this.body.push(
        `\\addplot[${color}, thick] coordinates {(${fmt(at)},${fmt(ymin)}) (${fmt(at)},${fmt(ymax)})};`,
      );
      return;
    }
    this.skip(stmt.name, 'the equation has no x or y term');
  }

  private genCurve(stmt: T.CurveDecl): void {
    this.genSweep(stmt.name, stmt.var, stmt.start, stmt.end, stmt.step, stmt.body, stmt.style);
  }

  private genSweep(
    name: string,
    variable: string,
    startExpr: T.Expr,
    endExpr: T.Expr,
    stepExpr: T.Expr | undefined,
    body: T.Expr,
    style: T.StyleBlock | undefined,
  ): void {
    const start = this.evalConst(startExpr);
    const end = this.evalConst(endExpr);
    if (start === null || end === null) {
      this.skip(name, 'the domain of the curve is not constant');
      return;
    }

    const step = this.evalConst(stepExpr);
    const samples = step && step > 0
      ? Math.max(2, Math.round(Math.abs(end - start) / step) + 1)
      : this.samples;

    this.scope.set(variable, '\\t');
    const color = this.color(style?.gradient?.from ?? style?.color, COLORS.curve);
    const domain = `domain=${fmt(start)}:${fmt(end)}, variable=\\t, samples=${samples}`;

    if (body.type === 'Tuple') {
      const px = this.pgf(body.x);
      const py = this.pgf(body.y);
      this.scope.clear();
      if (px === null || py === null) {
        this.skip(name, 'the curve body has no pgfmath form');
        return;
      }
      const fill = style?.opacity !== undefined
        ? `, fill=${color}, fill opacity=${fmt(style.opacity)}`
        : '';
      this.body.push(`\\addplot[${color}, thick, smooth, ${domain}${fill}] ({${px}}, {${py}});`);
      return;
    }

    const value = this.pgf(body);
    this.scope.clear();
    if (value === null) {
      this.skip(name, 'the curve body has no pgfmath form');
      return;
    }
    this.body.push(`\\addplot[${color}, only marks, mark=*, mark size=1pt, ${domain}] ({\\t}, {${value}});`);
  }

  private genPolygon(stmt: T.PolygonDecl): void {
    const pts: string[] = [];
    for (const p of stmt.points) {
      const at = this.point(p.x, p.y);
      if (!at) {
        this.skip(stmt.name, 'a vertex is not constant');
        return;
      }
      pts.push(at);
    }
    if (pts.length === 0) return;
    const color = this.color(stmt.style?.color, COLORS.polygon);
    const opacity = stmt.style?.opacity ?? 0.2;
    this.body.push(
      `\\addplot[${color}, thick, fill=${color}, fill opacity=${fmt(opacity)}] ` +
      `coordinates {${[...pts, pts[0]].join(' ')}};`,
    );
  }

  private genSegment(stmt: T.SegmentDecl): void {
    const p1 = this.point(stmt.p1.x, stmt.p1.y);
    const p2 = this.point(stmt.p2.x, stmt.p2.y);
    if (!p1 || !p2) {
      this.skip(stmt.name, 'an endpoint is not constant');
      return;
    }
    const color = this.color(stmt.style?.color, COLORS.segment);
    this.body.push(`\\addplot[${color}, thick, no marks] coordinates {${p1} ${p2}};`);
  }

  private genText(stmt: T.TextDecl): void {
    const at = this.point(stmt.x, stmt.y);
    if (!at) {
      this.skip(stmt.name, 'the position is not constant');
      return;
    }
    const color = stmt.style?.color ? `${this.color(stmt.style.color, COLORS.point)}, ` : '';
    this.body.push(`\\node[${color}anchor=south west] at (axis cs:${at.slice(1, -1)}) {${texEscape(stmt.content)}};`);
  }

  private genSpiral(stmt: T.SpiralDecl): void {
    const turns = this.evalConst(stmt.turns);
    const spacing = this.pgf(stmt.spacing);
    if (turns === null || spacing === null) {
      this.skip(stmt.name, 'the turns or the spacing has no pgfmath form');
      return;
    }
    const cx = stmt.cx ? this.pgf(stmt.cx) : '0';
    const cy = stmt.cy ? this.pgf(stmt.cy) : '0';
    const rotate = stmt.rotate ? this.pgf(stmt.rotate) : '0';
    if (cx === null || cy === null || rotate === null) {
      this.skip(stmt.name, 'the centre or the rotation has no pgfmath form');
      return;
    }
    const color = this.color(stmt.style?.gradient?.from ?? stmt.style?.color, COLORS.spiral);
    const end = fmt(turns * 2 * Math.PI);
    this.body.push(
      `\\addplot[${color}, thick, smooth, samples=${Math.max(this.samples, Math.round(turns * 60))}, ` +
      `domain=0:${end}, variable=\\t] ` +
      `({${cx}+\\t*${spacing}*cos(deg(\\t+${rotate}))}, {${cy}+\\t*${spacing}*sin(deg(\\t+${rotate}))});`,
    );
  }

  private genWave(stmt: T.WaveDecl): void {
    const freq = this.pgf(stmt.freq);
    const amp = this.pgf(stmt.amp);
    if (freq === null || amp === null) {
      this.skip(stmt.name, 'the frequency or the amplitude has no pgfmath form');
      return;
    }
    const phase = stmt.phase ? this.pgf(stmt.phase) : '0';
    const cx = stmt.cx ? this.pgf(stmt.cx) : '0';
    const cy = stmt.cy ? this.pgf(stmt.cy) : '0';
    if (phase === null || cx === null || cy === null) {
      this.skip(stmt.name, 'the phase or the centre has no pgfmath form');
      return;
    }
    const xmin = this.evalConst(stmt.xmin) ?? -10;
    const xmax = this.evalConst(stmt.xmax) ?? 10;
    const color = this.color(stmt.style?.gradient?.from ?? stmt.style?.color, COLORS.wave);
    this.body.push(
      `\\addplot[${color}, thick, smooth, samples=${this.samples}, ` +
      `domain=${fmt(xmin)}:${fmt(xmax)}, variable=\\t] ` +
      `({\\t+${cx}}, {${amp}*sin(deg(${freq}*\\t+${phase}))+${cy}});`,
    );
  }

  private genGrid(stmt: T.GridDecl): void {
    const cols = this.evalConst(stmt.cols) ?? 10;
    const rows = this.evalConst(stmt.rows) ?? 10;
    const xmin = this.evalConst(stmt.xmin) ?? -(cols / 2);
    const xmax = this.evalConst(stmt.xmax) ?? cols / 2;
    const ymin = this.evalConst(stmt.ymin) ?? -(rows / 2);
    const ymax = this.evalConst(stmt.ymax) ?? rows / 2;

    const color = this.color(stmt.style?.color, COLORS.grid);
    const opacity = stmt.style?.lineOpacity ?? stmt.style?.opacity ?? 0.4;
    const width = stmt.style?.lineWidth ?? 1;
    const pen = `${color}, opacity=${fmt(opacity)}, line width=${fmt(width * 0.4)}pt, no marks`;

    for (let y = Math.ceil(ymin); y <= Math.floor(ymax); y++) {
      this.body.push(`\\addplot[${pen}] coordinates {(${fmt(xmin)},${fmt(y)}) (${fmt(xmax)},${fmt(y)})};`);
    }
    for (let x = Math.ceil(xmin); x <= Math.floor(xmax); x++) {
      this.body.push(`\\addplot[${pen}] coordinates {(${fmt(x)},${fmt(ymin)}) (${fmt(x)},${fmt(ymax)})};`);
    }
  }

  // the document

  private document(title?: string): string {
    const { xmin, xmax, ymin, ymax } = this.viewport;
    const equal = (xmax - xmin) === (ymax - ymin) ? '  axis equal image,\n' : '';

    const colorLines = [...this.colors].map(
      ([hex, name]) => `\\definecolor{${name}}{HTML}{${hex.replace('#', '').toUpperCase()}}`,
    );

    const preamble = [
      `% generated by desmos-ide from ${title ?? 'a .dsmx source'} — edit freely`,
      '\\documentclass[tikz,border=4pt]{standalone}',
      '\\usepackage{pgfplots}',
      '\\pgfplotsset{compat=1.18}',
      ...(colorLines.length ? ['', ...colorLines] : []),
      ...(this.macroLines.length ? ['', '% values the source declared', ...this.macroLines] : []),
      '',
      '\\begin{document}',
      '\\begin{tikzpicture}',
      '\\begin{axis}[',
      '  axis lines=middle,',
      '  xlabel=$x$, ylabel=$y$,',
      '  xlabel style={anchor=west}, ylabel style={anchor=south},',
      `  xmin=${fmt(xmin)}, xmax=${fmt(xmax)}, ymin=${fmt(ymin)}, ymax=${fmt(ymax)},`,
      equal + '  grid=none,',
      ']',
    ];

    const body = this.body.length ? this.body.map(l => `  ${l}`) : ['  % nothing in the source draws'];

    return [
      ...preamble,
      ...body,
      '\\end{axis}',
      '\\end{tikzpicture}',
      '\\end{document}',
      '',
    ].join('\n');
  }
}

export function toTex(program: T.Program, opts: TexOptions = {}): TexResult {
  return new TexGen(opts).generate(program, opts.title);
}
