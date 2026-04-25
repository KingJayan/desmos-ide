// recursive-descent parser

import { Token, TT } from './lexer';
import * as T from './types';

export class ParseError extends Error {
  constructor(
    msg: string,
    public readonly tok: Token,
  ) {
    super(`[${tok.line}:${tok.col}] Parse error: ${msg} (got '${tok.value}')`);
    this.name = 'ParseError';
  }
}

const KW_AS_FN = new Set(['time', 'project', 'camera', 'circle', 'map']);

export interface ParseErrorInfo {
  error: string;
  line: number;
  col: number;
  tokenLen?: number;
  phase: 1;
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

  private checkNext(type: TT, value?: string): boolean {
    const t = this.tokens[this.pos + 1];
    if (!t) return false;
    return t.type === type && (value === undefined || t.value === value);
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
    return { line: this.peek().line, col: this.peek().col };
  }

  parseProgram(): T.Program {
    const body: T.Statement[] = [];
    while (!this.check('eof')) {
      try {
        body.push(this.parseStatement());
      } catch (e) {
        if (e instanceof ParseError) {
          this.collectedErrors.push({
            error: e.message,
            line: e.tok.line,
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

  private recoverToNextStatement(): void {
    const stmtStartKws = new Set([
      'fn', 'alias', 'debug', 'expr',
      'point', 'circle', 'line', 'curve', 'region', 'polygon', 'segment', 'text', 'group',
      'spiral', 'wave', 'grid',
    ]);
    while (!this.check('eof')) {
      const t = this.peek();
      if (t.type === 'kw' && stmtStartKws.has(t.value)) return;
      if (t.type === 'ident' && this.checkNext('op', '=')) return;
      this.advance();
    }
  }

  private parseStatement(): T.Statement {
    const t = this.peek();

    if (t.type === 'kw') {
      switch (t.value) {
        case 'fn':      return this.parseFnDecl();
        case 'alias':   return this.parseAliasDecl();
        case 'debug':   return this.parseDebugDecl();
        case 'expr':    return this.parseExprBlockDecl();
        case 'point':   return this.parsePointStatement();
        case 'circle':  return this.parseCircleStatement();
        case 'line':    return this.parseLineStatement();
        case 'curve':   return this.parseCurveDecl();
        case 'region':  return this.parseRegionDecl();
        case 'polygon': return this.parsePolygonDecl();
        case 'segment': return this.parseSegmentDecl();
        case 'text':    return this.parseTextDecl();
        case 'group':   return this.parseGroupDecl();
        case 'spiral':  return this.parseSpiralDecl();
        case 'wave':    return this.parseWaveDecl();
        case 'grid':    return this.parseGridDecl();
      }
    }

    if (t.type === 'ident' && this.checkNext('op', '=')) {
      return this.parseVarDecl();
    }

    throw new ParseError(
      'Expected statement (fn / alias / debug / expr / point / circle / line / curve / region / polygon / segment / text / group / ident = expr)',
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

  private parseAliasDecl(): T.AliasDecl {
    const pos = this.curPos();
    this.eat('kw', 'alias');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    const value = this.parseExpr();
    return { type: 'AliasDecl', name, value, pos };
  }

  private parseDebugDecl(): T.DebugDecl {
    const pos = this.curPos();
    this.eat('kw', 'debug');
    const expr = this.parseExpr();
    return { type: 'DebugDecl', expr, pos };
  }

  private parseExprBlockDecl(): T.ExprBlockDecl {
    const pos = this.curPos();
    this.eat('kw', 'expr');
    this.eat('lbrace');
    const bindings: Array<{ name: string; value: T.Expr }> = [];

    while (!this.check('rbrace') && !this.check('eof')) {
      // peek ahead: if `ident =` it's a binding, otherwise it's the result
      if (this.check('ident') && this.checkNext('op', '=')) {
        const name = this.advance().value;
        this.advance(); // eat '='
        const value = this.parseExpr();
        bindings.push({ name, value });
      } else {
        // final result expression
        const result = this.parseExpr();
        this.eat('rbrace');
        return { type: 'ExprBlockDecl', bindings, result, pos };
      }
    }

    throw new ParseError('expr block must end with a result expression', this.peek());
  }

  private parsePointStatement(): T.PointDecl {
    const pos = this.curPos();
    this.eat('kw', 'point');
    const name = this.eat('ident').value;
    this.eat('lparen');
    const x = this.parseExpr();
    this.eat('comma');
    const y = this.parseExpr();
    this.eat('rparen');
    const style = this.parseStyleBlock();
    return { type: 'PointDecl', name, x, y, style, pos };
  }

  private parseCircleStatement(): T.CircleDecl {
    const pos = this.curPos();
    this.eat('kw', 'circle');
    const name = this.eat('ident').value;

    // block form: circle c { center (x,y)  radius r }
    if (this.check('lbrace')) {
      this.advance();
      let cx: T.Expr | undefined, cy: T.Expr | undefined, r: T.Expr | undefined;
      while (!this.check('rbrace') && !this.check('eof')) {
        const prop = this.eat('ident').value;
        if (prop === 'center') {
          this.eat('lparen');
          cx = this.parseExpr();
          this.eat('comma');
          cy = this.parseExpr();
          this.eat('rparen');
        } else if (prop === 'radius') {
          r = this.parseExpr();
        } else {
          throw new ParseError(`Unknown circle property '${prop}'`, this.tokens[this.pos - 1]);
        }
      }
      this.eat('rbrace');
      if (!cx || !cy) throw new ParseError("circle block requires 'center'", this.peek());
      if (!r)        throw new ParseError("circle block requires 'radius'", this.peek());
      const style = this.parseStyleBlock();
      return { type: 'CircleDecl', name, cx, cy, r, style, pos };
    }

    // classic form: circle c = circle((cx, cy), r)
    this.eat('op', '=');
    if (this.check('kw', 'circle') || (this.check('ident') && this.peek().value === 'circle')) {
      this.advance();
    } else {
      throw new ParseError("Expected 'circle((cx, cy), r)' or '{ center ... radius ... }'", this.peek());
    }
    this.eat('lparen');
    this.eat('lparen');
    const cx = this.parseExpr();
    this.eat('comma');
    const cy = this.parseExpr();
    this.eat('rparen');
    this.eat('comma');
    const r = this.parseExpr();
    this.eat('rparen');
    const style = this.parseStyleBlock();
    return { type: 'CircleDecl', name, cx, cy, r, style, pos };
  }

  private parseLineStatement(): T.LineDecl {
    const pos = this.curPos();
    this.eat('kw', 'line');
    const name = this.eat('ident').value;
    this.eat('op', '=');

    if (this.check('ident') && this.peek().value === 'slope') {
      this.advance();
      this.eat('lparen');
      const slope = this.parseExpr();
      this.eat('rparen');
      let intercept: T.Expr | undefined;
      if (this.check('comma')) {
        this.advance();
        if (this.check('ident') && this.peek().value === 'intercept') {
          this.advance();
          this.eat('lparen');
          intercept = this.parseExpr();
          this.eat('rparen');
        }
      }
      const style = this.parseStyleBlock();
      return { type: 'LineDecl', name, form: 'slope-intercept', slope, intercept, style, pos };
    }

    const lhs = this.parseExpr();

    if (this.check('op', '=')) {
      this.advance();
      const rhs = this.parseExpr();
      const style = this.parseStyleBlock();
      return { type: 'LineDecl', name, form: 'standard', lhs, rhs, style, pos };
    }

    const style = this.parseStyleBlock();
    return { type: 'LineDecl', name, form: 'expr', expr: lhs, style, pos };
  }

  private parseVarDecl(): T.VarDecl | T.CurveDecl {
    const pos = this.curPos();
    const name = this.eat('ident').value;
    this.eat('op', '=');
    const value = this.parseExpr();

    if (this.check('kw', 'for')) {
      this.advance();
      const varName = this.eat('ident').value;
      this.eat('kw', 'in');
      const start = this.parseExpr();
      this.eat('dotdot');
      const end = this.parseExpr();
      let step: T.Expr | undefined;
      if (this.check('kw', 'step')) {
        this.advance();
        step = this.parseExpr();
      }
      const style = this.parseStyleBlock();
      return { type: 'CurveDecl', name, var: varName, start, end, step, body: value, style, pos };
    }

    // domain restriction suffix
    let domain: T.Expr | undefined;
    if (this.check('kw', 'domain')) {
      this.advance();
      domain = this.parseComparison();
    }

    return { type: 'VarDecl', name, value, domain, pos };
  }

  private parseCurveDecl(): T.CurveDecl {
    const pos = this.curPos();
    this.eat('kw', 'curve');
    const name = this.eat('ident').value;
    this.eat('lparen');
    const varName = this.eat('ident').value;
    this.eat('kw', 'in');
    const start = this.parseExpr();
    this.eat('dotdot');
    const end = this.parseExpr();
    let step: T.Expr | undefined;
    if (this.check('kw', 'step')) {
      this.advance();
      step = this.parseExpr();
    }
    this.eat('rparen');
    this.eat('lbrace');
    const body = this.parseExpr();
    this.eat('rbrace');
    const style = this.parseStyleBlock();
    return { type: 'CurveDecl', name, var: varName, start, end, step, body, style, pos };
  }

  private parseRegionDecl(): T.RegionDecl {
    const pos = this.curPos();
    this.eat('kw', 'region');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    const expr = this.parseExpr();
    const style = this.parseStyleBlock();
    return { type: 'RegionDecl', name, expr, style, pos };
  }

  private parsePolygonDecl(): T.PolygonDecl {
    const pos = this.curPos();
    this.eat('kw', 'polygon');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    this.eat('lbracket');
    const points: T.Tuple[] = [];
    while (!this.check('rbracket')) {
      const tpos = this.curPos();
      this.eat('lparen');
      const x = this.parseExpr();
      this.eat('comma');
      const y = this.parseExpr();
      this.eat('rparen');
      points.push({ type: 'Tuple', x, y, pos: tpos });
      if (this.check('comma')) this.advance();
    }
    this.eat('rbracket');
    const style = this.parseStyleBlock();
    return { type: 'PolygonDecl', name, points, style, pos };
  }

  private parseSegmentDecl(): T.SegmentDecl {
    const pos = this.curPos();
    this.eat('kw', 'segment');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    const p1pos = this.curPos();
    this.eat('lparen');
    const x1 = this.parseExpr();
    this.eat('comma');
    const y1 = this.parseExpr();
    this.eat('rparen');
    const p1: T.Tuple = { type: 'Tuple', x: x1, y: y1, pos: p1pos };
    this.eat('arrow');
    const p2pos = this.curPos();
    this.eat('lparen');
    const x2 = this.parseExpr();
    this.eat('comma');
    const y2 = this.parseExpr();
    this.eat('rparen');
    const p2: T.Tuple = { type: 'Tuple', x: x2, y: y2, pos: p2pos };
    const style = this.parseStyleBlock();
    return { type: 'SegmentDecl', name, p1, p2, style, pos };
  }

  private parseTextDecl(): T.TextDecl {
    const pos = this.curPos();
    this.eat('kw', 'text');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    const contentTok = this.eat('str');
    this.eat('kw', 'at');
    this.eat('lparen');
    const x = this.parseExpr();
    this.eat('comma');
    const y = this.parseExpr();
    this.eat('rparen');
    return { type: 'TextDecl', name, content: contentTok.value, x, y, pos };
  }

  private parseGroupDecl(): T.GroupDecl {
    const pos = this.curPos();
    this.eat('kw', 'group');
    const name = this.eat('ident').value;
    this.eat('kw', 'as');
    const labelTok = this.eat('str');
    return { type: 'GroupDecl', name, label: labelTok.value, pos };
  }

  private parseGeneratorKwargs(allowed: string[]): Record<string, T.Expr> {
    const out: Record<string, T.Expr> = {};
    this.eat('lparen');
    while (!this.check('rparen') && !this.check('eof')) {
      if (this.check('ident') && allowed.includes(this.peek().value) && this.checkNext('op', '=')) {
        const key = this.advance().value;
        this.advance();
        out[key] = this.parseExpr();
      } else {
        const key = allowed[Object.keys(out).length];
        if (key) out[key] = this.parseExpr();
        else throw new ParseError('Unexpected positional argument', this.peek());
      }
      if (this.check('comma')) this.advance();
    }
    this.eat('rparen');
    return out;
  }

  private parseSpiralDecl(): T.SpiralDecl {
    const pos = this.curPos();
    this.eat('kw', 'spiral');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    this.eat('kw', 'spiral');
    const kw = this.parseGeneratorKwargs(['turns', 'spacing', 'cx', 'cy', 'rotate']);
    if (!kw['turns'])   throw new ParseError("spiral requires 'turns'",   this.peek());
    if (!kw['spacing']) throw new ParseError("spiral requires 'spacing'", this.peek());
    const style = this.parseStyleBlock();
    return { type: 'SpiralDecl', name, turns: kw['turns'], spacing: kw['spacing'], cx: kw['cx'], cy: kw['cy'], rotate: kw['rotate'], style, pos };
  }

  private parseWaveDecl(): T.WaveDecl {
    const pos = this.curPos();
    this.eat('kw', 'wave');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    this.eat('kw', 'wave');
    const kw = this.parseGeneratorKwargs(['freq', 'amp', 'phase', 'cx', 'cy', 'xmin', 'xmax']);
    if (!kw['freq']) throw new ParseError("wave requires 'freq'", this.peek());
    if (!kw['amp'])  throw new ParseError("wave requires 'amp'",  this.peek());
    const style = this.parseStyleBlock();
    return { type: 'WaveDecl', name, freq: kw['freq'], amp: kw['amp'], phase: kw['phase'], cx: kw['cx'], cy: kw['cy'], xmin: kw['xmin'], xmax: kw['xmax'], style, pos };
  }

  private parseGridDecl(): T.GridDecl {
    const pos = this.curPos();
    this.eat('kw', 'grid');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    this.eat('kw', 'grid');
    const kw = this.parseGeneratorKwargs(['cols', 'rows', 'xmin', 'xmax', 'ymin', 'ymax']);
    if (!kw['cols']) throw new ParseError("grid requires 'cols'", this.peek());
    if (!kw['rows']) throw new ParseError("grid requires 'rows'", this.peek());
    const style = this.parseStyleBlock();
    return { type: 'GridDecl', name, cols: kw['cols'], rows: kw['rows'], xmin: kw['xmin'], xmax: kw['xmax'], ymin: kw['ymin'], ymax: kw['ymax'], style, pos };
  }

  private parseGradientArgs(): T.StyleBlock['gradient'] {
    this.eat('lparen');
    const from = this.parsePrimary();
    this.eat('comma');
    const to = this.parsePrimary();
    this.eat('rparen');
    return { from, to };
  }

  private parseStyleBlock(): T.StyleBlock | undefined {
    if (!this.check('kw', 'as')) return undefined;
    this.advance();

    if (this.check('ident') && this.peek().value === 'gradient') {
      this.advance();
      return { gradient: this.parseGradientArgs() };
    }

    this.eat('lbrace');
    const style: T.StyleBlock = {};
    while (!this.check('rbrace') && !this.check('eof')) {
      if (this.check('ident')) {
        const prop = this.advance();
        switch (prop.value) {
          case 'color':
            style.color = this.parsePrimary();
            break;
          case 'gradient':
            style.gradient = this.parseGradientArgs();
            break;
          case 'opacity': {
            const n = this.eat('num');
            style.opacity = parseFloat(n.value);
            break;
          }
          case 'fill':
            style.fill = true;
            break;
          case 'pointSize': {
            const n = this.eat('num');
            style.pointSize = parseFloat(n.value);
            break;
          }
          case 'lineWidth': {
            const n = this.eat('num');
            style.lineWidth = parseFloat(n.value);
            break;
          }
          case 'lineOpacity': {
            const n = this.eat('num');
            style.lineOpacity = parseFloat(n.value);
            break;
          }
          default:
            throw new ParseError(`Unknown style property '${prop.value}'`, prop);
        }
      } else {
        throw new ParseError('Expected style property name', this.peek());
      }
    }
    this.eat('rbrace');
    return style;
  }

  private parseListRange(): T.ListRange {
    const pos = this.curPos();
    this.eat('lbracket');
    const start = this.parseExpr();
    let step: T.Expr | undefined;
    if (this.check('comma')) {
      this.advance();
      step = this.parseExpr();
    }
    this.eat('ellipsis');
    const end = this.parseExpr();
    this.eat('rbracket');
    return { type: 'ListRange', start, end, step, pos };
  }

  private parseInlineRange(pos: T.Pos): T.ListRange {
    const start = this.parseExpr();
    this.eat('dotdot');
    const end = this.parseExpr();
    let step: T.Expr | undefined;
    if (this.check('kw', 'step')) {
      this.advance();
      step = this.parseExpr();
    }
    return { type: 'ListRange', start, end, step, pos };
  }

  private parseExpr(): T.Expr {
    // if/then/else → ConditionalExpr
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

    // where/else → ConditionalExpr
    if (this.check('kw', 'where')) {
      const pos = this.curPos();
      this.advance();
      const cond = this.parseComparison();
      this.eat('kw', 'else');
      const else_ = this.parseExpr();
      return { type: 'ConditionalExpr', cond, then: expr, else_, pos };
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
    while (this.check('op', '*') || this.check('op', '/')) {
      const op = this.advance().value as '*' | '/';
      const pos = this.curPos();
      const right = this.parseUnary();
      left = { type: 'BinOp', op, left, right, pos };
    }
    return left;
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
    const pos: T.Pos = { line: t.line, col: t.col };

    if (t.type === 'str') {
      this.advance();
      return { type: 'StringLit', value: t.value, pos };
    }

    if (t.type === 'num') {
      this.advance();
      return { type: 'NumLit', value: parseFloat(t.value), pos };
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
      return this.parseListRange();
    }

    if (t.type === 'ident' || (t.type === 'kw' && KW_AS_FN.has(t.value))) {
      const name = this.advance().value;

      // new map syntax: map(i -> body, start..end step n)
      if (name === 'map') {
        this.eat('lparen');
        const varName = this.eat('ident').value;
        this.eat('arrow');
        const body = this.parseExpr();
        this.eat('comma');
        const range = this.parseInlineRange(pos);
        this.eat('rparen');
        return { type: 'MapExpr', var: varName, range, body, pos };
      }

      if (this.check('lparen')) {
        this.advance();
        const args: T.Expr[] = [];
        const kwargs: Record<string, T.Expr> = {};

        while (!this.check('rparen') && !this.check('eof')) {
          // bare 'loop' flag → kwarg loop=1
          if (this.check('kw', 'loop')) {
            this.advance();
            kwargs['loop'] = { type: 'NumLit', value: 1, pos: this.curPos() };
          // keyword-named kwarg (step=, speed=, etc.)
          } else if (
            (this.check('ident') || this.check('kw', 'step')) &&
            this.checkNext('op', '=')
          ) {
            const kname = this.advance().value;
            this.advance();
            kwargs[kname] = this.parseExpr();
          } else {
            args.push(this.parseExpr());
          }
          if (this.check('comma')) this.advance();
        }
        this.eat('rparen');
        const call: T.Call = { type: 'Call', fn: name, args, pos };
        if (Object.keys(kwargs).length > 0) call.kwargs = kwargs;
        return call;
      }

      return { type: 'Ident', name, pos };
    }

    throw new ParseError('Unexpected token in expression', t);
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
