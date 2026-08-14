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

export function analyze(program: T.Program): SemanticError[] {
  const errors: SemanticError[] = [];

  const declaredFns = new Map<string, { params: string[]; pos: T.Pos }>();
  const declaredVars = new Set<string>(DESMOS_IMPLICIT);

  for (const stmt of program.body) {
    switch (stmt.type) {
      case 'FnDecl':
        declaredFns.set(stmt.name, { params: stmt.params, pos: stmt.pos });
        break;
      case 'VarDecl':
      case 'AliasDecl':
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
    }
  }

  for (const stmt of program.body) {
    checkStmt(stmt, declaredFns, declaredVars, errors);
  }

  return errors;
}

function checkStmt(
  stmt: T.Statement,
  fns: Map<string, { params: string[]; pos: T.Pos }>,
  vars: Set<string>,
  errors: SemanticError[],
): void {
  const cx = (e: T.Expr, localVars = vars) => checkExpr(e, fns, localVars, errors);

  switch (stmt.type) {
    case 'VarDecl':
      cx(stmt.value);
      if (stmt.domain) cx(stmt.domain);
      break;
    case 'AliasDecl':
      cx(stmt.value);
      break;
    case 'DebugDecl':
      cx(stmt.expr);
      break;
    case 'ExprBlockDecl': {
      const localVars = new Set(vars);
      for (const b of stmt.bindings) {
        cx(b.value, localVars);
        localVars.add(b.name);
      }
      cx(stmt.result, localVars);
      break;
    }
    case 'FnDecl': {
      const localVars = new Set(vars);
      for (const p of stmt.params) localVars.add(p);
      cx(stmt.body, localVars);
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
      const localVars = new Set(vars);
      localVars.add(stmt.var);
      cx(stmt.start); cx(stmt.end);
      if (stmt.step) cx(stmt.step);
      cx(stmt.body, localVars);
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
  }
}

function checkExpr(
  expr: T.Expr,
  fns: Map<string, { params: string[]; pos: T.Pos }>,
  vars: Set<string>,
  errors: SemanticError[],
): void {
  const cx = (e: T.Expr, localVars = vars) => checkExpr(e, fns, localVars, errors);

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

    case 'MapExpr': {
      cx(expr.range);
      const localVars = new Set(vars);
      localVars.add(expr.var);
      cx(expr.body, localVars);
      break;
    }

    case 'ForExpr': {
      cx(expr.start); cx(expr.end);
      if (expr.step) cx(expr.step);
      const localVars = new Set(vars);
      localVars.add(expr.var);
      cx(expr.body, localVars);
      break;
    }
  }
}
