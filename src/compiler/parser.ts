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

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  //util

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private check(type: TT, value?: string): boolean {
    const t = this.peek();
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

  //top level parsign

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
        case 'let':    return this.parseLetDecl();
        case 'fn':     return this.parseFnDecl();
        case 'point':
        case 'circle':
        case 'line':   return this.parseEntityDecl();
        case 'points': return this.parseListDecl();
      }
    }
    throw new ParseError('Expected statement (let / fn / point / circle / line / points)', t);
  }

  // declarations

  private parseLetDecl(): T.LetDecl {
    const pos = this.curPos();
    this.eat('kw', 'let');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    const value = this.parseExpr();
    return { type: 'LetDecl', name, value, pos };
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

  private parseEntityDecl(): T.EntityDecl {
    const pos = this.curPos();
    const kind = this.advance().value as T.EntityKind;
    const name = this.eat('ident').value;
    this.eat('lbrace');
    const props: Record<string, T.Expr> = {};
    while (!this.check('rbrace')) {
      const key = this.eat('ident').value;
      this.eat('colon');
      props[key] = this.parseExpr();
      if (this.check('comma')) this.advance();
    }
    this.eat('rbrace');
    return { type: 'EntityDecl', kind, name, props, pos };
  }

  private parseListDecl(): T.ListDecl {
    const pos = this.curPos();
    this.eat('kw', 'points');
    const name = this.eat('ident').value;
    this.eat('op', '=');
    const map = this.parseMapExpr();
    return { type: 'ListDecl', name, map, pos };
  }

  // map/range parsing

  private parseMapExpr(): T.MapExpr {
    const pos = this.curPos();
    this.eat('kw', 'map');
    this.eat('lparen');
    const varName = this.eat('ident').value;
    this.eat('kw', 'in');
    const range = this.parseListRange();
    this.eat('rparen');
    this.eat('lbrace');
    const body = this.parseExpr();
    this.eat('rbrace');
    return { type: 'MapExpr', var: varName, range, body, pos };
  }

  private parseListRange(): T.ListRange {
    const pos = this.curPos();
    this.eat('lbracket');
    const start = this.parseExpr();

    // Support [start, step...end] (stepped range)
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

  // expr grammar (precedence climbing)
  //
  //   expr        - additive
  //   additive    - multiplicative (('+' | '-') multiplicative)*
  //   multiplicative - unary (('*' | '/') unary)*
  //   unary       - '-' unary | power
  //   power       - primary ('^' unary)*          ← right-associative
  //   primary     - NUM | IDENT | call | tuple | grouped | list-range

  private parseExpr(): T.Expr {
    return this.parseAdditive();
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
      const exp = this.parseUnary(); // right-associative: 2^3^4 = 2^(3^4)
      return { type: 'BinOp', op: '^', left: base, right: exp, pos };
    }
    return base;
  }

  private parsePrimary(): T.Expr {
    const t = this.peek();
    const pos: T.Pos = { line: t.line, col: t.col };
    let result: T.Expr;

    // numeric literal
    if (t.type === 'num') {
      this.advance();
      result = { type: 'NumLit', value: parseFloat(t.value), pos };
    }
    // grouped expression or tuple: '(' expr ')' | '(' expr ',' expr ')'
    else if (t.type === 'lparen') {
      this.advance();
      const x = this.parseExpr();
      if (this.check('comma')) {
        this.advance();
        const y = this.parseExpr();
        this.eat('rparen');
        result = { type: 'Tuple', x, y, pos };
      } else {
        this.eat('rparen');
        result = x;
      }
    }
    // list range literal: '[' expr '...' expr ']'
    else if (t.type === 'lbracket') {
      result = this.parseListRange();
    }
    // ident, kw-as-call, or func call
    else if (t.type === 'ident' || t.type === 'kw') {
      const name = this.advance().value;
      if (this.check('lparen')) {
        this.advance();
        const args: T.Expr[] = [];
        while (!this.check('rparen')) {
          args.push(this.parseExpr());
          if (this.check('comma')) this.advance();
        }
        this.eat('rparen');
        result = { type: 'Call', fn: name, args, pos };
      } else {
        result = { type: 'Ident', name, pos };
      }
    }
    else {
      throw new ParseError('Unexpected token in expression', t);
    }

    // domain range: expr..expr  (optionally chained with .play / .loop / .loop(-1))
    if (this.check('dotdot')) {
      this.advance();
      const end = this.parseAdditive();
      let method: T.AnimMethod = 'static';
      let loopDir: 1 | -1 = 1;
      if (this.check('dot')) {
        this.advance();
        const methodName = this.eat('ident').value;
        if (methodName === 'play') {
          method = 'play';
        } else if (methodName === 'loop') {
          method = 'loop';
          if (this.check('lparen')) {
            this.advance();
            if (this.check('op', '-')) { this.advance(); loopDir = -1; }
            this.eat('num'); // consume the 1
            this.eat('rparen');
          }
        } else {
          throw new ParseError(`Unknown animation method '${methodName}'`, this.peek());
        }
      }
      result = { type: 'DomainExpr', start: result, end, method, loopDir, pos };
    }

    return result;
  }
}

export function parse(tokens: Token[]): T.Program {
  return new Parser(tokens).parseProgram();
}
