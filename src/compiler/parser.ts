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

const KW_AS_FN = new Set(['time', 'project', 'camera', 'circle']);

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  // util

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
      body.push(this.parseStatement());
    }
    return { type: 'Program', body };
  }

  private parseStatement(): T.Statement {
    const t = this.peek();

    if (t.type === 'kw') {
      switch (t.value) {
        case 'fn':      return this.parseFnDecl();
        case 'point':   return this.parsePointStatement();
        case 'circle':  return this.parseCircleStatement();
        case 'line':    return this.parseLineStatement();
        case 'curve':   return this.parseCurveDecl();
        case 'region':  return this.parseRegionDecl();
        case 'polygon': return this.parsePolygonDecl();
        case 'segment': return this.parseSegmentDecl();
        case 'text':    return this.parseTextDecl();
        case 'group':   return this.parseGroupDecl();
      }
    }

    // ident = expr  →  VarDecl
    if (t.type === 'ident' && this.checkNext('op', '=')) {
      return this.parseVarDecl();
    }

    throw new ParseError(
      'Expected statement (fn / point / circle / line / curve / region / polygon / segment / text / group / ident = expr)',
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
    this.eat('op', '=');
    if (this.check('kw', 'circle') || (this.check('ident') && this.peek().value === 'circle')) {
      this.advance();
    } else {
      throw new ParseError("Expected 'circle((cx, cy), r)'", this.peek());
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

    return { type: 'VarDecl', name, value, pos };
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


  private parseStyleBlock(): T.StyleBlock | undefined {
    if (!this.check('kw', 'as')) return undefined;
    this.advance();
    this.eat('lbrace');
    const style: T.StyleBlock = {};
    while (!this.check('rbrace') && !this.check('eof')) {
      if (this.check('ident')) {
        const prop = this.advance();
        switch (prop.value) {
          case 'color':
            style.color = this.parsePrimary();
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


  private parseExpr(): T.Expr {
    const expr = this.parseComparison();
    if (this.check('kw', 'where')) {
      const pos = this.curPos();
      this.advance();
      const cond = this.parseComparison();
      this.eat('kw', 'else');
      const else_ = this.parseExpr(); // right-associative chaining
      return { type: 'ConditionalExpr', cond, then: expr, else_, pos };
    }
    return expr;
  }

  private static readonly CMP_OPS = new Set(['>', '<', '>=', '<=', '!=', '==']);

  private parseComparison(): T.Expr {
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
      const exp = this.parseUnary(); // right-associative
      return { type: 'BinOp', op: '^', left: base, right: exp, pos };
    }
    return base;
  }

  private parsePrimary(): T.Expr {
    const t = this.peek();
    const pos: T.Pos = { line: t.line, col: t.col };

    // string literal
    if (t.type === 'str') {
      this.advance();
      return { type: 'StringLit', value: t.value, pos };
    }

    // numeric literal
    if (t.type === 'num') {
      this.advance();
      return { type: 'NumLit', value: parseFloat(t.value), pos };
    }

    // piecewise block: { cond: expr, ..., else: expr }
    if (t.type === 'lbrace') {
      return this.parsePiecewiseExpr();
    }

    // grouped expr or tuple: '(' expr ')' | '(' expr ',' expr ')'
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

    // legacy list range lit: '[' expr (',' expr)? '...' expr ']'
    if (t.type === 'lbracket') {
      return this.parseListRange();
    }

    // ident, kw-as-func-name, or kw-callable
    if (t.type === 'ident' || (t.type === 'kw' && KW_AS_FN.has(t.value))) {
      const name = this.advance().value;

      if (name === 'map' || (t.type === 'kw' && t.value === 'map')) {
        const mpos = pos;
        this.eat('lparen');
        const varName = this.eat('ident').value;
        this.eat('kw', 'in');
        const range = this.parseListRange();
        this.eat('rparen');
        this.eat('lbrace');
        const body = this.parseExpr();
        this.eat('rbrace');
        return { type: 'MapExpr', var: varName, range, body, pos: mpos };
      }

      if (this.check('lparen')) {
        this.advance();
        const args: T.Expr[] = [];
        const kwargs: Record<string, T.Expr> = {};
        while (!this.check('rparen')) {
          if (this.check('ident') && this.checkNext('op', '=')) {
            const kname = this.advance().value;
            this.advance(); // eat '='
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

export function parse(tokens: Token[]): T.Program {
  return new Parser(tokens).parseProgram();
}
