// phase 2 semantic analysis

import * as T from './types';
import { isBuiltin } from './builtins';

export interface SemanticError {
  error: string;
  line: number;
  col: number;
  phase: 2;
}

const DESMOS_IMPLICIT = new Set([
  'x', 'y', 't', 'r', 'theta', 'e', 'pi',
  'Infinity', 'inf',
]);

/** remembers which statements came back clean, for as long as the declarations around
 * them stay the same. a statement's verdict depends on nothing else. */
export interface AnalyzeCache {
  vars: Set<string> | null;
  fns: Map<string, number> | null;
  clean: WeakSet<T.Statement>;
}

export function createAnalyzeCache(): AnalyzeCache {
  return { vars: null, fns: null, clean: new WeakSet() };
}

function sameVars(a: Set<string> | null, b: Set<string>): boolean {
  if (!a || a.size !== b.size) return false;
  for (const n of b) if (!a.has(n)) return false;
  return true;
}

function sameFns(a: Map<string, number> | null, b: Map<string, { params: string[] }>): boolean {
  if (!a || a.size !== b.size) return false;
  for (const [n, def] of b) if (a.get(n) !== def.params.length) return false;
  return true;
}

export function analyze(program: T.Program, cache?: AnalyzeCache): SemanticError[] {
  const errors: SemanticError[] = [];

  const declaredFns = new Map<string, { params: string[]; pos: T.Pos }>();
  const declaredVars = new Set<string>(DESMOS_IMPLICIT);
  const times: T.Statement[] = [];
  const cameras: T.Statement[] = [];

  for (const stmt of program.body) {
    switch (stmt.type) {
      case 'FnDecl':
        declaredFns.set(stmt.name, { params: stmt.params, pos: stmt.pos });
        break;
      case 'VarDecl':
        declaredVars.add(stmt.name);
        break;
      case 'PointDecl':   declaredVars.add(stmt.name); break;
      case 'CircleDecl':  declaredVars.add(stmt.name); break;
      case 'LineDecl':    declaredVars.add(stmt.name); break;
      case 'CurveDecl':   declaredVars.add(stmt.name); break;
      case 'RegionDecl':  declaredVars.add(stmt.name); break;
      case 'PolygonDecl': declaredVars.add(stmt.name); break;
      case 'SegmentDecl': declaredVars.add(stmt.name); break;
      case 'TextDecl':    declaredVars.add(stmt.name); break;
      case 'SpiralDecl':  declaredVars.add(stmt.name); break;
      case 'WaveDecl':    declaredVars.add(stmt.name); break;
      case 'GridDecl':    declaredVars.add(stmt.name); break;
      case 'TimeDecl':    declaredVars.add(stmt.name); times.push(stmt);   break;
      case 'CameraDecl':  declaredVars.add(stmt.name); cameras.push(stmt); break;
    }
  }

  // project() reads one camera and the transport drives one clock, so a second of
  // either has no way to say which one is meant
  onlyOne(times, 'time', errors);
  onlyOne(cameras, 'camera', errors);

  if (!cache) {
    for (const stmt of program.body) checkStmt(stmt, declaredFns, declaredVars, errors);
    return errors;
  }

  if (!sameVars(cache.vars, declaredVars) || !sameFns(cache.fns, declaredFns)) {
    cache.vars = new Set(declaredVars);
    cache.fns = new Map([...declaredFns].map(([n, d]) => [n, d.params.length]));
    cache.clean = new WeakSet();
  }

  for (const stmt of program.body) {
    if (cache.clean.has(stmt)) continue;
    const before = errors.length;
    checkStmt(stmt, declaredFns, declaredVars, errors);
    if (errors.length === before) cache.clean.add(stmt);
  }

  return errors;
}

/** adds names to the shared scope set, runs f, then removes only what it added.
 * copying the set per scope was quadratic. removing only what this scope added is
 * what keeps a param shadowing a real declaration from erasing it */
function withScope<R>(vars: Set<string>, names: readonly string[], f: () => R): R {
  const added = names.filter(n => !vars.has(n));
  for (const n of added) vars.add(n);
  try { return f(); } finally { for (const n of added) vars.delete(n); }
}

function checkStmt(
  stmt: T.Statement,
  fns: Map<string, { params: string[]; pos: T.Pos }>,
  vars: Set<string>,
  errors: SemanticError[],
): void {
  const cx = (e: T.Expr) => checkExpr(e, fns, vars, errors);

  switch (stmt.type) {
    case 'VarDecl':
      cx(stmt.value);
      if (stmt.domain) cx(stmt.domain);
      break;
    case 'DebugDecl':
      cx(stmt.expr);
      break;
    case 'FnDecl': {
      withScope(vars, stmt.params, () => cx(stmt.body));
      break;
    }
    case 'PointDecl':
      cx(stmt.x); cx(stmt.y);
      break;
    case 'CircleDecl':
      cx(stmt.cx); cx(stmt.cy); cx(stmt.r);
      break;
    case 'LineDecl':
      if (stmt.slope)     cx(stmt.slope);
      if (stmt.intercept) cx(stmt.intercept);
      if (stmt.lhs)       cx(stmt.lhs);
      if (stmt.rhs)       cx(stmt.rhs);
      if (stmt.expr)      cx(stmt.expr);
      break;
    case 'CurveDecl': {
      cx(stmt.start); cx(stmt.end);
      if (stmt.step) cx(stmt.step);
      withScope(vars, [stmt.var], () => cx(stmt.body));
      break;
    }
    case 'RegionDecl':    cx(stmt.expr);  break;
    case 'PolygonDecl':   stmt.points.forEach(p => { cx(p.x); cx(p.y); }); break;
    case 'SegmentDecl':   cx(stmt.p1.x); cx(stmt.p1.y); cx(stmt.p2.x); cx(stmt.p2.y); break;
    case 'TextDecl':      cx(stmt.x); cx(stmt.y); break;
    case 'SpiralDecl':
      cx(stmt.turns); cx(stmt.spacing);
      if (stmt.cx)     cx(stmt.cx);
      if (stmt.cy)     cx(stmt.cy);
      if (stmt.rotate) cx(stmt.rotate);
      break;
    case 'WaveDecl':
      cx(stmt.freq); cx(stmt.amp);
      if (stmt.phase) cx(stmt.phase);
      if (stmt.cx)    cx(stmt.cx);
      if (stmt.cy)    cx(stmt.cy);
      if (stmt.xmin)  cx(stmt.xmin);
      if (stmt.xmax)  cx(stmt.xmax);
      break;
    case 'GridDecl':
      cx(stmt.cols); cx(stmt.rows);
      if (stmt.xmin) cx(stmt.xmin);
      if (stmt.xmax) cx(stmt.xmax);
      if (stmt.ymin) cx(stmt.ymin);
      if (stmt.ymax) cx(stmt.ymax);
      break;
    case 'TimeDecl':
      if (stmt.start)  cx(stmt.start);
      if (stmt.end)    cx(stmt.end);
      if (stmt.period) cx(stmt.period);
      break;
    case 'CameraDecl':
      cx(stmt.azimuth); cx(stmt.elevation);
      break;
  }
}

/** reports every declaration of a kind past the first */
function onlyOne(
  found: readonly T.Statement[],
  keyword: string,
  errors: SemanticError[],
): void {
  for (let k = 1; k < found.length; k++) {
    const extra = found[k];
    errors.push({
      error: `Only one '${keyword}' declaration is allowed`,
      line: extra.pos.line,
      col: extra.pos.col,
      phase: 2,
    });
  }
}

function checkExpr(
  expr: T.Expr,
  fns: Map<string, { params: string[]; pos: T.Pos }>,
  vars: Set<string>,
  errors: SemanticError[],
): void {
  const cx = (e: T.Expr) => checkExpr(e, fns, vars, errors);

  switch (expr.type) {
    case 'NumLit':
    case 'StringLit':
      break;

    case 'Ident':
      if (!vars.has(expr.name)) {
        errors.push({
          error: `[${expr.pos.line}:${expr.pos.col}] Semantic error: undefined variable '${expr.name}'`,
          line: expr.pos.line,
          col: expr.pos.col,
          phase: 2,
        });
      }
      break;

    case 'BinOp':
      cx(expr.left); cx(expr.right);
      break;

    case 'UnaryOp':
      cx(expr.operand);
      break;

    case 'CompareExpr':
      cx(expr.left); cx(expr.right);
      break;

    case 'ConditionalExpr':
      cx(expr.cond); cx(expr.then); cx(expr.else_);
      break;

    case 'PiecewiseExpr':
      for (const b of expr.branches) {
        if (b.cond) cx(b.cond);
        cx(b.body);
      }
      break;

    case 'Call': {
      const isMath = isBuiltin(expr.fn);
      const isUserFn = fns.has(expr.fn);

      if (!isMath && !isUserFn) {
        errors.push({
          error: `[${expr.pos.line}:${expr.pos.col}] Semantic error: undefined function '${expr.fn}'`,
          line: expr.pos.line,
          col: expr.pos.col,
          phase: 2,
        });
      } else if (isUserFn) {
        const def = fns.get(expr.fn)!;
        if (expr.args.length !== def.params.length) {
          errors.push({
            error: `[${expr.pos.line}:${expr.pos.col}] Semantic error: '${expr.fn}' expects ${def.params.length} argument(s), got ${expr.args.length}`,
            line: expr.pos.line,
            col: expr.pos.col,
            phase: 2,
          });
        }
      }

      expr.args.forEach(a => cx(a));
      if (expr.kwargs) Object.values(expr.kwargs).forEach(v => cx(v));
      break;
    }

    case 'Tuple':
      cx(expr.x); cx(expr.y);
      break;

    case 'ListRange':
      cx(expr.start); cx(expr.end);
      if (expr.step) {
        cx(expr.step);
        if (expr.step.type === 'NumLit' && expr.step.value <= 0) {
          errors.push({
            error: `[${expr.step.pos.line}:${expr.step.pos.col}] Semantic error: generator step must be positive`,
            line: expr.step.pos.line,
            col: expr.step.pos.col,
            phase: 2,
          });
        }
      }
      break;

    case 'ListLit':
      expr.items.forEach(cx);
      break;

    case 'Lambda':
      errors.push({
        error: `[${expr.pos.line}:${expr.pos.col}] Semantic error: a -> function is only allowed where a builtin takes one`,
        line: expr.pos.line,
        col: expr.pos.col,
        phase: 2,
      });
      break;

    case 'ForExpr': {
      cx(expr.start); cx(expr.end);
      if (expr.step) cx(expr.step);
      withScope(vars, [expr.var], () => cx(expr.body));
      break;
    }
  }
}
