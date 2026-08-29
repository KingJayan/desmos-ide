// recursive-descent parser

import { Token, TT, posOf } from './lexer';
import * as T from './types';

export class ParseError extends Error {
  constructor(
    msg: string,
    public readonly tok: Token,
  ) {
    super(`[${tok.pos?.line ?? tok.line}:${tok.col}] Parse error: ${msg} (got '${tok.value}')`);
    this.name = 'ParseError';
  }
}

/** the type annotations a declaration may carry, each one a constructor as well */
export const KINDS = [
  'point', 'circle', 'line', 'curve', 'region', 'polygon', 'segment',
  'text', 'group', 'time', 'camera', 'spiral', 'wave', 'grid',
] as const;

export type Kind = (typeof KINDS)[number];

const KIND_SET = new Set<string>(KINDS);

const PROP_ALIASES: Record<string, string> = {
  xmin: 'xMin', xmax: 'xMax', ymin: 'yMin', ymax: 'yMax',
  cx: 'cX', cy: 'cY',
};

export interface ParseErrorInfo {
  error: string;
  line: number;
  col: number;
  tokenLen?: number;
  phase: 1;
}

/** replaces free identifiers; `expr { }` block inlines without reaching the ast */
function substitute(expr: T.Expr, subst: Map<string, T.Expr>): T.Expr {
  const s = (e: T.Expr) => substitute(e, subst);
  switch (expr.type) {
    case 'Ident': return subst.get(expr.name) ?? expr;
    case 'BinOp': return { ...expr, left: s(expr.left), right: s(expr.right) };
    case 'UnaryOp': return { ...expr, operand: s(expr.operand) };
    case 'CompareExpr': return { ...expr, left: s(expr.left), right: s(expr.right) };
    case 'ConditionalExpr': return { ...expr, cond: s(expr.cond), then: s(expr.then), else_: s(expr.else_) };
    case 'PiecewiseExpr':
      return { ...expr, branches: expr.branches.map(b => ({ cond: b.cond ? s(b.cond) : null, body: s(b.body) })) };
    case 'Call':
      return {
        ...expr,
        args: expr.args.map(s),
        ...(expr.kwargs
          ? { kwargs: Object.fromEntries(Object.entries(expr.kwargs).map(([k, v]) => [k, s(v)])) }
          : {}),
      };
    case 'Tuple': return { ...expr, x: s(expr.x), y: s(expr.y) };
    case 'ListLit': return { ...expr, items: expr.items.map(s) };
    case 'ListRange': return { ...expr, start: s(expr.start), end: s(expr.end), ...(expr.step ? { step: s(expr.step) } : {}) };
    case 'Lambda': return { ...expr, body: s(expr.body) };
    case 'ForExpr':
      return { ...expr, start: s(expr.start), end: s(expr.end), ...(expr.step ? { step: s(expr.step) } : {}), body: s(expr.body) };
    default: return expr;
  }
}

class Parser {
  private pos = 0;
  readonly collectedErrors: ParseErrorInfo[] = [];

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }

  private check(type: TT, value?: string): boolean {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }

  private at(offset: number, type: TT, value?: string): boolean {
    const t = this.tokens[this.pos + offset];
    if (!t) return false;
    return t.type === type && (value === undefined || t.value === value);
  }

  private checkNext(type: TT, value?: string): boolean {
    return this.at(1, type, value);
  }

  private eat(type: TT, value?: string): Token {
    if (!this.check(type, value)) {
      throw new ParseError(
        `Expected ${type}${value ? ` '${value}'` : ''}`,
        this.peek(),
      );
    }
    return this.advance();
  }

  private curPos(): T.Pos {
    return posOf(this.peek());
  }

  parseProgram(): T.Program {
    const body: T.Statement[] = [];
    while (true) {
      while (this.check('nl')) this.advance();
      if (this.check('eof')) break;
      try {
        body.push(this.parseStatement());
        this.eatTerminator();
      } catch (e) {
        if (e instanceof ParseError) {
          this.collectedErrors.push({
            error: e.message,
            line: e.tok.pos?.line ?? e.tok.line,
            col: e.tok.col,
            tokenLen: e.tok.value.length > 0 ? e.tok.value.length : undefined,
            phase: 1,
          });
          this.recoverToNextStatement();
        } else {
          throw e;
        }
      }
    }
    return { type: 'Program', body };
  }

  private eatTerminator(): void {
    if (this.check('eof')) return;
    if (!this.check('nl')) {
      throw new ParseError('Expected end of statement — put each statement on its own line', this.peek());
    }
    this.advance();
  }

  private recoverToNextStatement(): void {
    const from = this.pos;
    while (!this.check('eof')) {
      if (this.pos > from) {
        const t = this.peek();
        if (t.type === 'nl') { this.advance(); return; }
        if (t.type === 'kw' && (t.value === 'fn' || t.value === 'use' || t.value === 'debug')) return;
        if (t.type === 'ident' && this.checkNext('op', '=')) return;
        if (t.type === 'ident' && this.checkNext('ident') && this.at(2, 'op', '=')) return;
      }
      this.advance();
    }
  }

  private parseStatement(): T.Statement {
    const t = this.peek();

    if (t.type === 'kw') {
      switch (t.value) {
        case 'fn':    return this.parseFnDecl();
        case 'debug': return this.parseDebugDecl();
        case 'use':   return this.parseUseDecl();
      }
    }

    if (t.type === 'ident' && this.checkNext('op', '=')) {
      return this.parseDecl(null);
    }

    if (t.type === 'ident' && this.checkNext('ident') && this.at(2, 'op', '=')) {
      if (!KIND_SET.has(t.value)) {
        throw new ParseError(`Unknown type '${t.value}' — expected one of ${KINDS.join(', ')}`, t);
      }
      this.advance();
      return this.parseDecl(t.value as Kind);
    }

    throw new ParseError(
      `Expected a statement: use "id", fn f(a) = ..., debug expr, or [${KINDS.join('|')}] name = expr`,
      t,
    );
  }

  private parseFnDecl(): T.FnDecl {
    const pos = this.curPos();
    this.eat('kw', 'fn');
    const name = this.eat('ident').value;
    this.eat('lparen');
    const params: string[] = [];
    while (!this.check('rparen')) {
      params.push(this.eat('ident').value);
      if (this.check('comma')) this.advance();
    }
    this.eat('rparen');
    this.eat('op', '=');
    const body = this.parseExpr();
    return { type: 'FnDecl', name, params, body, pos };
  }

  private parseDebugDecl(): T.DebugDecl {
    const pos = this.curPos();
    this.eat('kw', 'debug');
    const expr = this.parseExpr();
    return { type: 'DebugDecl', expr, pos };
  }

  private parseUseDecl(): T.UseDecl {
    const pos = this.curPos();
    this.eat('kw', 'use');
    const plugin = this.eat('str').value;
    return { type: 'UseDecl', plugin, pos };
  }

  /** the one statement shape: [kind] name = expr [where cond] [as { ... }] */
  private parseDecl(kind: Kind | null): T.Statement {
    const nameTok = this.peek();
    const pos = this.curPos();
    const name = this.eat('ident').value;
    this.eat('op', '=');
    const value = this.parseExpr();

    let domain: T.Expr | undefined;
    if (this.check('kw', 'where')) {
      this.advance();
      domain = this.parseComparison();
    }

    const style = this.parseStyleBlock();
    return this.build(kind, name, value, domain, style, pos, nameTok);
  }

  private build(
    kind: Kind | null,
    name: string,
    value: T.Expr,
    domain: T.Expr | undefined,
    style: T.StyleBlock | undefined,
    pos: T.Pos,
    tok: Token,
  ): T.Statement {
    const ctor = value.type === 'Call' && KIND_SET.has(value.fn) ? (value.fn as Kind) : null;

    if (kind && ctor && kind !== ctor) {
      throw new ParseError(`'${kind} ${name}' cannot be built by ${ctor}()`, tok);
    }

    const use = kind ?? ctor;
    if (!use) {
      if (value.type === 'Lambda') throw new ParseError('A -> function needs a builtin that takes one', tok);
      return { type: 'VarDecl', name, value, domain, pos };
    }

    if (domain) throw new ParseError(`'where' restricts a plain binding, not a ${use}`, tok);

    const call = ctor ? (value as T.Call) : null;
    const arg = (i: number, key: string): T.Expr | undefined => {
      if (!call) return undefined;
      const named = call.kwargs?.[key] ?? call.kwargs?.[PROP_ALIASES[key] ?? key];
      return named ?? call.args[i];
    };
    const need = (i: number, key: string): T.Expr => {
      const found = arg(i, key);
      if (!found) throw new ParseError(`${use}() needs '${key}'`, tok);
      return found;
    };
    const point = (e: T.Expr, key: string): T.Tuple => {
      if (e.type !== 'Tuple') throw new ParseError(`${use}() wants a point for '${key}'`, tok);
      return e;
    };

    switch (use) {
      case 'point': {
        if (!call) return { type: 'PointDecl', name, x: point(value, 'position').x, y: point(value, 'position').y, style, pos };
        if (call.args.length === 1) {
          const p = point(need(0, 'position'), 'position');
          return { type: 'PointDecl', name, x: p.x, y: p.y, style, pos };
        }
        return { type: 'PointDecl', name, x: need(0, 'x'), y: need(1, 'y'), style, pos };
      }

      case 'circle': {
        const c = point(need(0, 'center'), 'center');
        return { type: 'CircleDecl', name, cx: c.x, cy: c.y, r: need(1, 'radius'), style, pos };
      }

      case 'line': {
        if (!call) {
          if (value.type === 'CompareExpr' && value.op === '==') {
            return { type: 'LineDecl', name, form: 'standard', lhs: value.left, rhs: value.right, style, pos };
          }
          return { type: 'LineDecl', name, form: 'expr', expr: value, style, pos };
        }
        return {
          type: 'LineDecl', name, form: 'slope-intercept',
          slope: need(0, 'slope'), intercept: arg(1, 'intercept'), style, pos,
        };
      }

      case 'curve': {
        const fn = need(0, 'fn');
        if (fn.type !== 'Lambda') throw new ParseError("curve() wants a function, as in 'curve(t -> (cos t, sin t), 0..6.28)'", tok);
        const range = need(1, 'range');
        if (range.type !== 'ListRange') throw new ParseError('curve() wants a range, as in 0..6.28', tok);
        return {
          type: 'CurveDecl', name, var: fn.param,
          start: range.start, end: range.end, step: range.step ?? arg(2, 'step'),
          body: fn.body, style, pos,
        };
      }

      case 'region':
        return { type: 'RegionDecl', name, expr: call ? need(0, 'expr') : value, style, pos };

      case 'polygon': {
        const items = call
          ? (call.args.length === 1 && call.args[0].type === 'ListLit' ? call.args[0].items : call.args)
          : value.type === 'ListLit' ? value.items : [];
        if (!items.length) throw new ParseError('polygon() wants a list of points', tok);
        return { type: 'PolygonDecl', name, points: items.map(p => point(p, 'point')), style, pos };
      }

      case 'segment':
        return { type: 'SegmentDecl', name, p1: point(need(0, 'from'), 'from'), p2: point(need(1, 'to'), 'to'), style, pos };

      case 'text': {
        const content = need(0, 'content');
        if (content.type !== 'StringLit') throw new ParseError('text() wants a string', tok);
        const where = point(need(1, 'at'), 'at');
        return { type: 'TextDecl', name, content: content.value, x: where.x, y: where.y, style, pos };
      }

      case 'group': {
        const label = need(0, 'label');
        if (label.type !== 'StringLit') throw new ParseError('group() wants a string', tok);
        return { type: 'GroupDecl', name, label: label.value, pos };
      }

      case 'time': {
        const range = arg(0, 'range');
        if (range && range.type !== 'ListRange') throw new ParseError('time() wants a range, as in 0..10', tok);
        const mode = arg(2, 'mode');
        if (mode && !(mode.type === 'Ident' && (mode.name === 'loop' || mode.name === 'mirror'))) {
          throw new ParseError("time() mode is 'loop' or 'mirror'", tok);
        }
        return {
          type: 'TimeDecl', name,
          start: range?.start, end: range?.end,
          period: arg(1, 'period'),
          mode: mode ? (mode as T.Ident).name as T.TimeMode : undefined,
          pos,
        };
      }

      case 'camera':
        return { type: 'CameraDecl', name, azimuth: need(0, 'azimuth'), elevation: need(1, 'elevation'), pos };

      case 'spiral':
        return {
          type: 'SpiralDecl', name,
          turns: need(0, 'turns'), spacing: need(1, 'spacing'),
          cx: arg(2, 'cX'), cy: arg(3, 'cY'), rotate: arg(4, 'rotate'), style, pos,
        };

      case 'wave':
        return {
          type: 'WaveDecl', name,
          freq: need(0, 'freq'), amp: need(1, 'amp'), phase: arg(2, 'phase'),
          cx: arg(3, 'cX'), cy: arg(4, 'cY'), xmin: arg(5, 'xMin'), xmax: arg(6, 'xMax'), style, pos,
        };

      case 'grid':
        return {
          type: 'GridDecl', name,
          cols: need(0, 'cols'), rows: need(1, 'rows'),
          xmin: arg(2, 'xMin'), xmax: arg(3, 'xMax'), ymin: arg(4, 'yMin'), ymax: arg(5, 'yMax'), style, pos,
        };
    }
  }

  private parseStyleBlock(): T.StyleBlock | undefined {
    if (!this.check('kw', 'as')) return undefined;
    this.advance();
    this.eat('lbrace');

    const style: T.StyleBlock = {};
    while (!this.check('rbrace') && !this.check('eof')) {
      const prop = this.eat('ident');
      this.eat('colon');
      switch (prop.value) {
        case 'color':       style.color = this.parseExpr(); break;
        case 'gradient':    style.gradient = this.parseGradient(); break;
        case 'opacity':     style.opacity = this.parseExpr(); break;
        case 'pointSize':   style.pointSize = this.parseExpr(); break;
        case 'lineWidth':   style.lineWidth = this.parseExpr(); break;
        case 'lineOpacity': style.lineOpacity = this.parseExpr(); break;
        case 'fill': {
          const on = this.parseExpr();
          style.fill = !(on.type === 'NumLit' && on.value === 0);
          break;
        }
        default:
          throw new ParseError(`Unknown style property '${prop.value}'`, prop);
      }
      if (this.check('comma')) this.advance();
    }
    this.eat('rbrace');
    return style;
  }

  private parseGradient(): T.StyleBlock['gradient'] {
    const call = this.parseExpr();
    if (call.type !== 'Call' || call.fn !== 'gradient' || call.args.length !== 2) {
      throw new ParseError('gradient wants gradient(from, to)', this.peek());
    }
    return { from: call.args[0], to: call.args[1] };
  }

  private parseExpr(): T.Expr {
    if (this.check('ident') && this.checkNext('arrow')) {
      const pos = this.curPos();
      const param = this.advance().value;
      this.advance();
      return { type: 'Lambda', param, body: this.parseExpr(), pos };
    }

    if (this.check('kw', 'if')) {
      const pos = this.curPos();
      this.advance();
      const cond = this.parseComparison();
      this.eat('kw', 'then');
      const then = this.parseExpr();
      this.eat('kw', 'else');
      const else_ = this.parseExpr();
      return { type: 'ConditionalExpr', cond, then, else_, pos };
    }

    const expr = this.parseComparison();

    if (this.check('dotdot')) {
      const pos = this.curPos();
      this.advance();
      const end = this.parseComparison();
      let step: T.Expr | undefined;
      if (this.check('ident', 'step')) {
        this.advance();
        step = this.parseComparison();
      }
      return { type: 'ListRange', start: expr, end, step, pos };
    }

    return expr;
  }

  private static readonly CMP_OPS = new Set(['>', '<', '>=', '<=', '!=', '==']);

  parseComparison(): T.Expr {
    const left = this.parseAdditive();
    if (this.check('op') && Parser.CMP_OPS.has(this.peek().value)) {
      const pos = this.curPos();
      const op = this.advance().value as T.CompareOp;
      const right = this.parseAdditive();
      return { type: 'CompareExpr', op, left, right, pos };
    }
    return left;
  }

  private parseAdditive(): T.Expr {
    let left = this.parseMultiplicative();
    while (this.check('op', '+') || this.check('op', '-')) {
      const op = this.advance().value as '+' | '-';
      const pos = this.curPos();
      const right = this.parseMultiplicative();
      left = { type: 'BinOp', op, left, right, pos };
    }
    return left;
  }

  private parseMultiplicative(): T.Expr {
    let left = this.parseUnary();
    while (true) {
      if (this.check('op', '*') || this.check('op', '/')) {
        const op = this.advance().value as '*' | '/';
        const pos = this.curPos();
        const right = this.parseUnary();
        left = { type: 'BinOp', op, left, right, pos };
      } else if (this.startsImplicitFactor()) {
        const pos = this.curPos();
        const right = this.parseUnary();
        left = { type: 'BinOp', op: '*', left, right, implicit: true, pos };
      } else {
        return left;
      }
    }
  }

  private startsImplicitFactor(): boolean {
    if (this.peek().spaceBefore) return false;
    if (this.check('ident') && this.checkNext('arrow')) return false;
    return this.check('num') || this.check('ident') || this.check('lparen');
  }

  private parseUnary(): T.Expr {
    if (this.check('op', '-')) {
      const pos = this.curPos();
      this.advance();
      const operand = this.parsePower();
      return { type: 'UnaryOp', op: '-', operand, pos };
    }
    return this.parsePower();
  }

  private parsePower(): T.Expr {
    const base = this.parsePrimary();
    if (this.check('op', '^')) {
      const pos = this.curPos();
      this.advance();
      const exp = this.parseUnary();
      return { type: 'BinOp', op: '^', left: base, right: exp, pos };
    }
    return base;
  }

  private parsePrimary(): T.Expr {
    const t = this.peek();
    const pos: T.Pos = posOf(t);

    if (t.type === 'str') {
      this.advance();
      return { type: 'StringLit', value: t.value, pos };
    }

    if (t.type === 'num') {
      this.advance();
      return { type: 'NumLit', value: parseFloat(t.value), pos };
    }

    if (t.type === 'kw' && t.value === 'expr') {
      return this.parseBlock();
    }

    if (t.type === 'lbrace') {
      return this.parsePiecewiseExpr();
    }

    if (t.type === 'lparen') {
      this.advance();
      const x = this.parseExpr();
      if (this.check('comma')) {
        this.advance();
        const y = this.parseExpr();
        this.eat('rparen');
        return { type: 'Tuple', x, y, pos };
      }
      this.eat('rparen');
      return x;
    }

    if (t.type === 'lbracket') {
      return this.parseBracketed();
    }

    if (t.type === 'ident') {
      if (t.value === 'true' || t.value === 'false') {
        this.advance();
        return { type: 'NumLit', value: t.value === 'true' ? 1 : 0, pos };
      }

      const name = this.advance().value;

      if (this.check('lparen')) {
        this.advance();
        const args: T.Expr[] = [];
        const kwargs: Record<string, T.Expr> = {};

        while (!this.check('rparen') && !this.check('eof')) {
          if (this.check('ident') && this.checkNext('op', '=')) {
            const kname = this.advance().value;
            this.advance();
            kwargs[PROP_ALIASES[kname] ?? kname] = this.parseExpr();
          } else {
            args.push(this.parseExpr());
          }
          if (this.check('comma')) this.advance();
        }
        this.eat('rparen');

        if (name === 'map') {
          const [fn, range] = args;
          if (fn?.type !== 'Lambda' || range?.type !== 'ListRange') {
            throw new ParseError("map wants map(t -> expr, 0..1 step 0.1)", t);
          }
          return { type: 'ForExpr', body: fn.body, var: fn.param, start: range.start, end: range.end, step: range.step, pos };
        }

        const call: T.Call = { type: 'Call', fn: name, args, pos };
        if (Object.keys(kwargs).length > 0) call.kwargs = kwargs;
        return call;
      }

      return { type: 'Ident', name, pos };
    }

    throw new ParseError('Unexpected token in expression', t);
  }

  /** expr { a = ...  b = ...  result } — the bindings are inlined here */
  private parseBlock(): T.Expr {
    this.eat('kw', 'expr');
    this.eat('lbrace');
    const subst = new Map<string, T.Expr>();

    while (!this.check('rbrace') && !this.check('eof')) {
      if (this.check('ident') && this.checkNext('op', '=')) {
        const name = this.advance().value;
        this.advance();
        subst.set(name, substitute(this.parseExpr(), subst));
        continue;
      }
      const result = substitute(this.parseExpr(), subst);
      this.eat('rbrace');
      return result;
    }

    throw new ParseError('An expr block must end with a result expression', this.peek());
  }

  /** [a, b, c] | [a..b step s] | [e for t in a..b step s] */
  private parseBracketed(): T.Expr {
    const pos = this.curPos();
    this.eat('lbracket');

    if (this.check('rbracket')) {
      this.advance();
      return { type: 'ListLit', items: [], pos };
    }

    const first = this.parseExpr();

    if (this.check('kw', 'for')) {
      this.advance();
      const varName = this.eat('ident').value;
      this.eat('kw', 'in');
      const range = this.parseExpr();
      if (range.type !== 'ListRange') throw new ParseError('A comprehension wants a range, as in 0..1 step 0.1', this.peek());
      this.eat('rbracket');
      return { type: 'ForExpr', body: first, var: varName, start: range.start, end: range.end, step: range.step, pos };
    }

    if (first.type === 'ListRange' && this.check('rbracket')) {
      this.advance();
      return first;
    }

    const items = [first];
    while (this.check('comma')) {
      this.advance();
      if (this.check('rbracket')) break;
      items.push(this.parseExpr());
    }
    this.eat('rbracket');
    return { type: 'ListLit', items, pos };
  }

  private parsePiecewiseExpr(): T.PiecewiseExpr {
    const pos = this.curPos();
    this.eat('lbrace');
    const branches: Array<{ cond: T.Expr | null; body: T.Expr }> = [];
    while (!this.check('rbrace') && !this.check('eof')) {
      let cond: T.Expr | null = null;
      if (this.check('kw', 'else')) {
        this.advance();
      } else {
        cond = this.parseExpr();
      }
      this.eat('colon');
      const body = this.parseExpr();
      branches.push({ cond, body });
      if (this.check('comma')) this.advance();
    }
    this.eat('rbrace');
    return { type: 'PiecewiseExpr', branches, pos };
  }
}

export function parse(tokens: Token[]): { ast: T.Program; parseErrors: ParseErrorInfo[] } {
  const p = new Parser(tokens);
  const ast = p.parseProgram();
  return { ast, parseErrors: p.collectedErrors };
}
