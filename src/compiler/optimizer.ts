// optimizer
//
// collect function definitions
// inline all function calls (aggressive)
// algebraic identity reduction
// strip fn declarations 

import * as T from './types';

interface FnDef {
  params: string[];
  body: T.Expr;
}

interface Env {
  fns: Map<string, FnDef>;
}

export function optimize(program: T.Program): T.Program {
  const env: Env = { fns: new Map() };

  for (const stmt of program.body) {
    if (stmt.type === 'FnDecl') {
      env.fns.set(stmt.name, { params: stmt.params, body: stmt.body });
    }
  }

  const body: T.Statement[] = [];
  for (const stmt of program.body) {
    if (stmt.type === 'FnDecl') continue;
    body.push(optimizeStmt(stmt, env));
  }

  return { type: 'Program', body };
}

// stmt dispatch

function optimizeStmt(stmt: T.Statement, env: Env): T.Statement {
  switch (stmt.type) {
    case 'LetDecl':
      return { ...stmt, value: optimizeExpr(stmt.value, env) };

    case 'EntityDecl': {
      const props: Record<string, T.Expr> = {};
      for (const [k, v] of Object.entries(stmt.props)) {
        props[k] = optimizeExpr(v, env);
      }
      return { ...stmt, props };
    }

    case 'ListDecl':
      return { ...stmt, map: optimizeMap(stmt.map, env) };

    default:
      return stmt;
  }
}

function optimizeMap(map: T.MapExpr, env: Env): T.MapExpr {
  return {
    ...map,
    range: {
      ...map.range,
      start: optimizeExpr(map.range.start, env),
      end:   optimizeExpr(map.range.end,   env),
      step:  map.range.step ? optimizeExpr(map.range.step, env) : undefined,
    },
    body: optimizeExpr(map.body, env),
  };
}

// expr optimizer

export function optimizeExpr(expr: T.Expr, env: Env): T.Expr {
  switch (expr.type) {
    case 'NumLit':
    case 'Ident':
      return expr;

    case 'UnaryOp': {
      const operand = optimizeExpr(expr.operand, env);
      if (operand.type === 'NumLit') {
        return num(-operand.value, expr.pos);
      }
      // --x  -->  x
      if (operand.type === 'UnaryOp' && operand.op === '-') {
        return operand.operand;
      }
      return { ...expr, operand };
    }

    case 'BinOp': {
      const left  = optimizeExpr(expr.left,  env);
      const right = optimizeExpr(expr.right, env);

      // constant folding
      if (left.type === 'NumLit' && right.type === 'NumLit') {
        const v = foldBinOp(expr.op, left.value, right.value);
        if (v !== null) return num(v, expr.pos);
      }

      // alg identities
      switch (expr.op) {
        case '+':
          if (isZero(left))  return right;
          if (isZero(right)) return left;
          break;
        case '-':
          if (isZero(right)) return left;
          if (isZero(left))  return { type: 'UnaryOp', op: '-', operand: right, pos: expr.pos };
          break;
        case '*':
          if (isOne(left))   return right;
          if (isOne(right))  return left;
          if (isZero(left) || isZero(right)) return num(0, expr.pos);
          break;
        case '/':
          if (isOne(right))  return left;
          if (isZero(left))  return num(0, expr.pos);
          break;
        case '^':
          if (isOne(right))  return left;
          if (isZero(right)) return num(1, expr.pos);
          if (isZero(left))  return num(0, expr.pos);
          break;
      }

      return { ...expr, left, right };
    }

    case 'Call': {
      const args = expr.args.map(a => optimizeExpr(a, env));

      // codegen-level builtins
      if (expr.fn === 'time' || expr.fn === 'project' || expr.fn === 'camera' || expr.fn === 'rgb' || expr.fn === 'hsv') {
        return { ...expr, args };
      }

      // inline user-defined functions
      const fn = env.fns.get(expr.fn);
      if (fn) {
        if (args.length !== fn.params.length) {
          // arity mismatch — leave as-is
          return { ...expr, args };
        }
        return inlineCall(fn, args, env);
      }

      return { ...expr, args };
    }

    case 'Tuple':
      return { ...expr, x: optimizeExpr(expr.x, env), y: optimizeExpr(expr.y, env) };

    case 'ListRange':
      return {
        ...expr,
        start: optimizeExpr(expr.start, env),
        end:   optimizeExpr(expr.end,   env),
        step:  expr.step ? optimizeExpr(expr.step, env) : undefined,
      };

    case 'MapExpr':
      return optimizeMap(expr, env);

  }
}

//helpers
function inlineCall(fn: FnDef, args: T.Expr[], env: Env): T.Expr {
  const subst = new Map<string, T.Expr>();
  fn.params.forEach((p, i) => subst.set(p, args[i]));
  const substituted = substituteExpr(fn.body, subst);
  return optimizeExpr(substituted, env);
}

function substituteExpr(expr: T.Expr, subst: Map<string, T.Expr>): T.Expr {
  switch (expr.type) {
    case 'NumLit': return expr;
    case 'Ident':  return subst.get(expr.name) ?? expr;

    case 'BinOp':
      return { ...expr, left: substituteExpr(expr.left, subst), right: substituteExpr(expr.right, subst) };

    case 'UnaryOp':
      return { ...expr, operand: substituteExpr(expr.operand, subst) };

    case 'Call':
      return { ...expr, args: expr.args.map(a => substituteExpr(a, subst)) };

    case 'Tuple':
      return { ...expr, x: substituteExpr(expr.x, subst), y: substituteExpr(expr.y, subst) };

    case 'ListRange': {
      const newSubst = new Map(subst);
      return {
        ...expr,
        start: substituteExpr(expr.start, newSubst),
        end:   substituteExpr(expr.end,   newSubst),
        step:  expr.step ? substituteExpr(expr.step, newSubst) : undefined,
      };
    }

    case 'MapExpr': {
      // Loop variable shadows outer bindings
      const newSubst = new Map(subst);
      newSubst.delete(expr.var);
      return {
        ...expr,
        range: substituteExpr(expr.range, newSubst) as T.ListRange,
        body:  substituteExpr(expr.body,  newSubst),
      };
    }

  }
}

function foldBinOp(op: string, a: number, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : null;
    case '^': return Math.pow(a, b);
    default:  return null;
  }
}

const isZero = (e: T.Expr) => e.type === 'NumLit' && e.value === 0;
const isOne  = (e: T.Expr) => e.type === 'NumLit' && e.value === 1;
const num    = (value: number, pos: T.Pos): T.NumLit => ({ type: 'NumLit', value, pos });
