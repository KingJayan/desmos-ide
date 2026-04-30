// optimizer — shadow-safe (all transforms operate on cloned nodes)

import * as T from './types';

interface FnDef { params: string[]; body: T.Expr; }
interface Env { fns: Map<string, FnDef>; }

function collectAllRefs(program: T.Program): Set<string> {
  const refs = new Set<string>();
  const walk = (e: T.Expr): void => {
    switch (e.type) {
      case 'Ident': refs.add(e.name); break;
      case 'BinOp': walk(e.left); walk(e.right); break;
      case 'UnaryOp': walk(e.operand); break;
      case 'CompareExpr': walk(e.left); walk(e.right); break;
      case 'ConditionalExpr': walk(e.cond); walk(e.then); walk(e.else_); break;
      case 'PiecewiseExpr': e.branches.forEach(b => { if (b.cond) walk(b.cond); walk(b.body); }); break;
      case 'Call': refs.add(e.fn); e.args.forEach(walk); if (e.kwargs) Object.values(e.kwargs).forEach(walk); break;
      case 'Tuple': walk(e.x); walk(e.y); break;
      case 'ListRange': walk(e.start); walk(e.end); if (e.step) walk(e.step); break;
      case 'MapExpr': walk(e.range); walk(e.body); break;
      case 'ForExpr': walk(e.start); walk(e.end); if (e.step) walk(e.step); walk(e.body); break;
    }
  };
  for (const stmt of program.body) {
    if (stmt.type === 'AliasDecl' || stmt.type === 'FnDecl') continue;
    switch (stmt.type) {
      case 'VarDecl': walk(stmt.value); if (stmt.domain) walk(stmt.domain); break;
      case 'DebugDecl': walk(stmt.expr); break;
      case 'ExprBlockDecl': stmt.bindings.forEach(b => walk(b.value)); walk(stmt.result); break;
      case 'PointDecl': walk(stmt.x); walk(stmt.y); break;
      case 'CircleDecl': walk(stmt.cx); walk(stmt.cy); walk(stmt.r); break;
      case 'LineDecl': [stmt.slope, stmt.intercept, stmt.lhs, stmt.rhs, stmt.expr].forEach(e => e && walk(e)); break;
      case 'CurveDecl': walk(stmt.start); walk(stmt.end); if (stmt.step) walk(stmt.step); walk(stmt.body); break;
      case 'RegionDecl': walk(stmt.expr); break;
      case 'PolygonDecl': stmt.points.forEach(p => { walk(p.x); walk(p.y); }); break;
      case 'SegmentDecl': walk(stmt.p1.x); walk(stmt.p1.y); walk(stmt.p2.x); walk(stmt.p2.y); break;
      case 'TextDecl': walk(stmt.x); walk(stmt.y); break;
      case 'SpiralDecl': walk(stmt.turns); walk(stmt.spacing); [stmt.cx, stmt.cy, stmt.rotate].forEach(e => e && walk(e)); break;
      case 'WaveDecl': [stmt.freq, stmt.amp, stmt.phase, stmt.cx, stmt.cy, stmt.xmin, stmt.xmax].forEach(e => e && walk(e)); break;
      case 'GridDecl': [stmt.cols, stmt.rows, stmt.xmin, stmt.xmax, stmt.ymin, stmt.ymax].forEach(e => e && walk(e)); break;
    }
  }
  // also collect refs inside alias bodies (aliases can reference other aliases)
  for (const stmt of program.body) {
    if (stmt.type === 'AliasDecl') walk(stmt.value);
    if (stmt.type === 'FnDecl') walk(stmt.body);
  }
  return refs;
}

export function optimize(program: T.Program): T.Program {
  const env: Env = { fns: new Map() };

  for (const stmt of program.body) {
    if (stmt.type === 'FnDecl') {
      env.fns.set(stmt.name, { params: stmt.params, body: stmt.body });
    }
  }

  const usedRefs = collectAllRefs(program);

  const body: T.Statement[] = [];
  for (const stmt of program.body) {
    if (stmt.type === 'FnDecl') {
      body.push({ ...stmt, body: optimizeExpr(stmt.body, env) });
      continue;
    }
    if (stmt.type === 'DebugDecl') continue;

    // strip unreferenced aliases — they produce no graph output when unused
    if (stmt.type === 'AliasDecl' && !usedRefs.has(stmt.name)) continue;

    if (stmt.type === 'ExprBlockDecl') {
      body.push(lowerExprBlock(stmt, env));
      continue;
    }

    body.push(optimizeStmt(stmt, env));
  }

  return { type: 'Program', body };
}

function lowerExprBlock(stmt: T.ExprBlockDecl, env: Env): T.VarDecl {
  // binding names are mangled to avoid global namespace pollution
  const subst = new Map<string, T.Expr>();
  for (const b of stmt.bindings) {
    const val = optimizeExpr(substituteExpr(b.value, subst), env);
    subst.set(b.name, val);
  }
  const result = optimizeExpr(substituteExpr(stmt.result, subst), env);
  // emit as an anonymous expression using a generated identifier
  return { type: 'VarDecl', name: `__expr_${stmt.pos.line}_${stmt.pos.col}`, value: result, pos: stmt.pos };
}

function optimizeStmt(stmt: T.Statement, env: Env): T.Statement {
  const ox = (e: T.Expr) => optimizeExpr(e, env);
  const oxopt = (e: T.Expr | undefined) => e ? ox(e) : undefined;

  switch (stmt.type) {
    case 'VarDecl':
      return { ...stmt, value: ox(stmt.value), domain: oxopt(stmt.domain) };

    case 'AliasDecl':
      return { ...stmt, value: ox(stmt.value) };

    case 'PointDecl':
      return { ...stmt, x: ox(stmt.x), y: ox(stmt.y) };

    case 'CircleDecl':
      return { ...stmt, cx: ox(stmt.cx), cy: ox(stmt.cy), r: ox(stmt.r) };

    case 'LineDecl': {
      const s = stmt;
      return {
        ...s,
        slope:     oxopt(s.slope),
        intercept: oxopt(s.intercept),
        lhs:       oxopt(s.lhs),
        rhs:       oxopt(s.rhs),
        expr:      oxopt(s.expr),
      };
    }

    case 'CurveDecl':
      return {
        ...stmt,
        start: ox(stmt.start),
        end:   ox(stmt.end),
        step:  oxopt(stmt.step),
        body:  ox(stmt.body),
      };

    case 'RegionDecl':
      return { ...stmt, expr: ox(stmt.expr) };

    case 'PolygonDecl':
      return { ...stmt, points: stmt.points.map(p => ox(p) as T.Tuple) };

    case 'SegmentDecl':
      return {
        ...stmt,
        p1: ox(stmt.p1) as T.Tuple,
        p2: ox(stmt.p2) as T.Tuple,
      };

    case 'TextDecl':
      return { ...stmt, x: ox(stmt.x), y: ox(stmt.y) };

    case 'GroupDecl':
      return stmt;

    case 'SpiralDecl':
      return {
        ...stmt,
        turns:   ox(stmt.turns),
        spacing: ox(stmt.spacing),
        cx:      oxopt(stmt.cx),
        cy:      oxopt(stmt.cy),
        rotate:  oxopt(stmt.rotate),
      };

    case 'WaveDecl':
      return {
        ...stmt,
        freq:  ox(stmt.freq),
        amp:   ox(stmt.amp),
        phase: oxopt(stmt.phase),
        cx:    oxopt(stmt.cx),
        cy:    oxopt(stmt.cy),
        xmin:  oxopt(stmt.xmin),
        xmax:  oxopt(stmt.xmax),
      };

    case 'GridDecl':
      return {
        ...stmt,
        cols: ox(stmt.cols),
        rows: ox(stmt.rows),
        xmin: oxopt(stmt.xmin),
        xmax: oxopt(stmt.xmax),
        ymin: oxopt(stmt.ymin),
        ymax: oxopt(stmt.ymax),
      };

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

export function optimizeExpr(expr: T.Expr, env: Env, depth = 0): T.Expr {
  const ox = (e: T.Expr) => optimizeExpr(e, env, depth);

  switch (expr.type) {
    case 'NumLit':
    case 'StringLit':
    case 'Ident':
      return expr;

    case 'UnaryOp': {
      const operand = ox(expr.operand);
      if (operand.type === 'NumLit') return num(-operand.value, expr.pos);
      if (operand.type === 'UnaryOp' && operand.op === '-') return operand.operand;
      return { ...expr, operand };
    }

    case 'BinOp': {
      const left  = ox(expr.left);
      const right = ox(expr.right);

      if (left.type === 'NumLit' && right.type === 'NumLit') {
        const v = foldBinOp(expr.op, left.value, right.value);
        if (v !== null) return num(v, expr.pos);
      }

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

    case 'CompareExpr':
      return { ...expr, left: ox(expr.left), right: ox(expr.right) };

    case 'ConditionalExpr':
      return { ...expr, cond: ox(expr.cond), then: ox(expr.then), else_: ox(expr.else_) };

    case 'PiecewiseExpr':
      return {
        ...expr,
        branches: expr.branches.map(b => ({
          cond: b.cond ? ox(b.cond) : null,
          body: ox(b.body),
        })),
      };

    case 'Call': {
      const args = expr.args.map(a => ox(a));
      const kwargs = expr.kwargs
        ? Object.fromEntries(Object.entries(expr.kwargs).map(([k, v]) => [k, ox(v)]))
        : undefined;

      const BUILTINS = new Set(['time', 'project', 'camera', 'rgb', 'hsv', 'slider']);
      if (BUILTINS.has(expr.fn)) return { ...expr, args, kwargs };

      const fn = env.fns.get(expr.fn);
      if (fn) {
        if (args.length !== fn.params.length) {
          throw new Error(`'${expr.fn}' expects ${fn.params.length} argument(s), got ${args.length}`);
        }
        return inlineCall(fn, args, env, depth);
      }

      return { ...expr, args, kwargs };
    }

    case 'Tuple':
      return { ...expr, x: ox(expr.x), y: ox(expr.y) };

    case 'ListRange':
      return {
        ...expr,
        start: ox(expr.start),
        end:   ox(expr.end),
        step:  expr.step ? ox(expr.step) : undefined,
      };

    case 'MapExpr':
      return optimizeMap(expr, env);

    case 'ForExpr':
      return {
        ...expr,
        body:  ox(expr.body),
        start: ox(expr.start),
        end:   ox(expr.end),
        step:  expr.step ? ox(expr.step) : undefined,
      };
  }
}

const MAX_INLINE_DEPTH = 20;

function inlineCall(fn: FnDef, args: T.Expr[], env: Env, depth: number): T.Expr {
  if (depth >= MAX_INLINE_DEPTH) {
    throw new Error('Recursive function exceeds max inline depth — use a non-recursive form');
  }
  const subst = new Map<string, T.Expr>();
  fn.params.forEach((p, i) => subst.set(p, args[i]));
  const substituted = substituteExpr(fn.body, subst);
  return optimizeExpr(substituted, env, depth + 1);
}

export function substituteExpr(expr: T.Expr, subst: Map<string, T.Expr>): T.Expr {
  switch (expr.type) {
    case 'NumLit':
    case 'StringLit':
      return expr;
    case 'Ident':
      return subst.get(expr.name) ?? expr;

    case 'BinOp':
      return { ...expr, left: substituteExpr(expr.left, subst), right: substituteExpr(expr.right, subst) };

    case 'UnaryOp':
      return { ...expr, operand: substituteExpr(expr.operand, subst) };

    case 'CompareExpr':
      return { ...expr, left: substituteExpr(expr.left, subst), right: substituteExpr(expr.right, subst) };

    case 'ConditionalExpr':
      return {
        ...expr,
        cond:  substituteExpr(expr.cond, subst),
        then:  substituteExpr(expr.then, subst),
        else_: substituteExpr(expr.else_, subst),
      };

    case 'PiecewiseExpr':
      return {
        ...expr,
        branches: expr.branches.map(b => ({
          cond: b.cond ? substituteExpr(b.cond, subst) : null,
          body: substituteExpr(b.body, subst),
        })),
      };

    case 'Call':
      return {
        ...expr,
        args: expr.args.map(a => substituteExpr(a, subst)),
        kwargs: expr.kwargs
          ? Object.fromEntries(Object.entries(expr.kwargs).map(([k, v]) => [k, substituteExpr(v, subst)]))
          : undefined,
      };

    case 'Tuple':
      return { ...expr, x: substituteExpr(expr.x, subst), y: substituteExpr(expr.y, subst) };

    case 'ListRange': {
      return {
        ...expr,
        start: substituteExpr(expr.start, subst),
        end:   substituteExpr(expr.end,   subst),
        step:  expr.step ? substituteExpr(expr.step, subst) : undefined,
      };
    }

    case 'MapExpr': {
      const newSubst = new Map(subst);
      newSubst.delete(expr.var);
      return {
        ...expr,
        range: substituteExpr(expr.range, newSubst) as T.ListRange,
        body:  substituteExpr(expr.body,  newSubst),
      };
    }

    case 'ForExpr': {
      const newSubst = new Map(subst);
      newSubst.delete(expr.var);
      return {
        ...expr,
        body:  substituteExpr(expr.body,  newSubst),
        start: substituteExpr(expr.start, subst),
        end:   substituteExpr(expr.end,   subst),
        step:  expr.step ? substituteExpr(expr.step, subst) : undefined,
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