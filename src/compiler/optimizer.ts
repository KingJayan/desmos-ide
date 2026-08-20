
import * as T from './types';
import { ANIMATION_PRESETS } from './builtins';
import { printShort } from './print';

interface FnDef { params: string[]; body: T.Expr; }
interface Env {
  fns: Map<string, FnDef>;
  notes: OptimizeNote[] | null;
  seen: Set<string>;
  replayed: Set<OptimizeNote>;
  /** notes are cached across compiles, so they have to read their position back */
  live: boolean;
  record: Map<string, FnDef | undefined> | null;
}

export interface OptimizeCache {
  stmts: WeakMap<T.Statement, OptEntry>;
  fns: Map<string, FnDef> | null;
  hits: number;
  misses: number;
}

interface OptEntry {
  fns: Map<string, FnDef | undefined>;
  result: T.Statement;
  notes: OptimizeNote[];
}

export function createOptimizeCache(): OptimizeCache {
  return { stmts: new WeakMap(), fns: null, hits: 0, misses: 0 };
}

function lookupFn(env: Env, name: string): FnDef | undefined {
  const def = env.fns.get(name);
  if (env.record) env.record.set(name, def);
  return def;
}

/** when no function definition moved, every recorded lookup still resolves the same way
 * and the per-statement comparison can be skipped outright */
function sameFnTable(prev: Map<string, FnDef> | null, now: Map<string, FnDef>): boolean {
  if (!prev || prev.size !== now.size) return false;
  for (const [name, def] of now) {
    const was = prev.get(name);
    if (!was || was.body !== def.body || was.params !== def.params) return false;
  }
  return true;
}

function fnsMatch(record: Map<string, FnDef | undefined>, fns: Map<string, FnDef>): boolean {
  for (const [name, was] of record) {
    const now = fns.get(name);
    if (was === undefined || now === undefined) {
      if (was !== now) return false;
      continue;
    }
    if (was.body !== now.body || was.params !== now.params) return false;
  }
  return true;
}

// cached notes are the same objects every compile, so identity is enough to dedupe them
// and saves building a key string per note per keystroke
function replayNote(env: Env, n: OptimizeNote): void {
  if (!env.notes || env.replayed.has(n)) return;
  env.replayed.add(n);
  env.notes.push(n);
}

export type OptimizeKind = 'fold' | 'identity' | 'inline' | 'drop';

export interface OptimizeNote {
  kind: OptimizeKind;
  line: number;
  col: number;
  before: string;
  after: string;
}

function note(env: Env, kind: OptimizeKind, pos: T.Pos, mkBefore: () => string, mkAfter: () => string, depth = 0): void {
  if (!env.notes || depth > 0) return;
  const before = mkBefore();
  const after  = mkAfter();
  if (before === after) return;
  const key = `${pos.line}:${pos.col}:${before}>${after}`;
  if (env.seen.has(key)) return;
  env.seen.add(key);
  const n: OptimizeNote = env.live
    ? { kind, before, after, get line() { return pos.line; }, get col() { return pos.col; } }
    : { kind, before, after, line: pos.line, col: pos.col };
  env.replayed.add(n);
  env.notes.push(n);
}

/** the whole-program reference set is only ever asked whether a name is live */
export type RefSet = { has(name: string): boolean };

export interface RefsCache {
  stmts: WeakMap<T.Statement, Set<string>>;
  prev: readonly T.Statement[];
  counts: Map<string, number>;
}

export function createRefsCache(): RefsCache {
  return { stmts: new WeakMap(), prev: [], counts: new Map() };
}

function ownRefs(stmt: T.Statement, cache: RefsCache): Set<string> {
  let own = cache.stmts.get(stmt);
  if (!own) {
    own = collectAllRefs({ type: 'Program', body: [stmt] }) as Set<string>;
    cache.stmts.set(stmt, own);
  }
  return own;
}

export function collectAllRefs(program: T.Program, cache?: RefsCache): RefSet {
  if (cache) {
    // the union is kept as a multiset so an edit only has to retract the statements it
    // removed and count in the ones it added, instead of re-merging every statement
    const { prev, counts } = cache;
    const now = program.body;

    let head = 0;
    while (head < prev.length && head < now.length && prev[head] === now[head]) head++;

    let tail = 0;
    while (
      tail < prev.length - head &&
      tail < now.length - head &&
      prev[prev.length - 1 - tail] === now[now.length - 1 - tail]
    ) tail++;

    for (let i = head; i < prev.length - tail; i++) {
      for (const n of ownRefs(prev[i], cache)) {
        const c = (counts.get(n) ?? 1) - 1;
        if (c > 0) counts.set(n, c);
        else counts.delete(n);
      }
    }
    for (let i = head; i < now.length - tail; i++) {
      for (const n of ownRefs(now[i], cache)) counts.set(n, (counts.get(n) ?? 0) + 1);
    }

    cache.prev = now;
    return counts;
  }

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
      case 'TimeDecl': [stmt.start, stmt.end, stmt.period].forEach(e => e && walk(e)); break;
      case 'CameraDecl': walk(stmt.azimuth); walk(stmt.elevation); break;
    }
  }
  for (const stmt of program.body) {
    if (stmt.type === 'AliasDecl') walk(stmt.value);
    if (stmt.type === 'FnDecl') walk(stmt.body);
  }
  return refs;
}

export function optimize(
  program: T.Program,
  notes: OptimizeNote[] | null = null,
  usedRefs: RefSet = collectAllRefs(program),
  cache?: OptimizeCache,
): T.Program {
  const reuse = notes ? cache : undefined;
  const env: Env = { fns: new Map(), notes, seen: new Set(), replayed: new Set(), live: !!reuse, record: null };

  for (const stmt of program.body) {
    if (stmt.type === 'FnDecl') {
      env.fns.set(stmt.name, { params: stmt.params, body: stmt.body });
    }
  }

  const fnsUnmoved = !!reuse && sameFnTable(reuse.fns, env.fns);

  const body: T.Statement[] = [];
  for (const stmt of program.body) {
    if (stmt.type === 'UseDecl') continue;
    if (stmt.type === 'DebugDecl') {
      note(env, 'drop', stmt.pos, () => `debug ${printShort(stmt.expr)}`, () => 'no output');
      continue;
    }

    if (stmt.type === 'AliasDecl' && !usedRefs.has(stmt.name)) {
      note(env, 'drop', stmt.pos, () => `alias ${stmt.name}`, () => 'never used');
      continue;
    }

    const hit = reuse?.stmts.get(stmt);
    if (hit && (fnsUnmoved || fnsMatch(hit.fns, env.fns))) {
      reuse!.hits++;
      for (const n of hit.notes) replayNote(env, n);
      body.push(hit.result);
      continue;
    }
    if (reuse) reuse.misses++;

    const record = reuse ? new Map<string, FnDef | undefined>() : null;
    const from = notes ? notes.length : 0;
    env.record = record;

    let out: T.Statement;
    if (stmt.type === 'FnDecl') {
      const fnBody = optimizeExpr(stmt.body, env);
      out = fnBody === stmt.body ? stmt : { ...stmt, body: fnBody };
    } else if (stmt.type === 'ExprBlockDecl') {
      out = lowerExprBlock(stmt, env);
    } else {
      out = optimizeStmt(stmt, env);
    }

    env.record = null;
    if (record) reuse!.stmts.set(stmt, { fns: record, result: out, notes: notes!.slice(from) });
    body.push(out);
  }

  if (reuse) reuse.fns = env.fns;
  return { type: 'Program', body };
}

function lowerExprBlock(stmt: T.ExprBlockDecl, env: Env): T.VarDecl {
  const subst = new Map<string, T.Expr>();
  for (const b of stmt.bindings) {
    const val = optimizeExpr(substituteExpr(b.value, subst), env);
    subst.set(b.name, val);
  }
  const result = optimizeExpr(substituteExpr(stmt.result, subst), env);
  return { type: 'VarDecl', name: `__expr_${stmt.pos.line}_${stmt.pos.col}`, value: result, pos: stmt.pos };
}

function mapKeep<A>(xs: A[], f: (x: A) => A): A[] {
  let out: A[] | null = null;
  for (let i = 0; i < xs.length; i++) {
    const y = f(xs[i]);
    if (out) out.push(y);
    else if (y !== xs[i]) { out = xs.slice(0, i); out.push(y); }
  }
  return out ?? xs;
}

/** the same, for the kwargs record */
function mapKwargs(
  kw: Record<string, T.Expr> | undefined,
  f: (e: T.Expr) => T.Expr,
): Record<string, T.Expr> | undefined {
  if (!kw) return undefined;
  let out: Record<string, T.Expr> | null = null;
  for (const k of Object.keys(kw)) {
    const v = f(kw[k]);
    if (v !== kw[k]) { out ??= { ...kw }; out[k] = v; }
  }
  return out ?? kw;
}

function optimizeStmt(stmt: T.Statement, env: Env): T.Statement {
  const ox = (e: T.Expr) => optimizeExpr(e, env);
  const oxopt = (e: T.Expr | undefined) => e ? ox(e) : undefined;


  switch (stmt.type) {
    case 'VarDecl': {
      const value = ox(stmt.value), domain = oxopt(stmt.domain);
      if (value === stmt.value && domain === stmt.domain) return stmt;
      return { ...stmt, value, domain };
    }

    case 'AliasDecl': {
      const value = ox(stmt.value);
      return value === stmt.value ? stmt : { ...stmt, value };
    }

    case 'PointDecl': {
      const x = ox(stmt.x), y = ox(stmt.y);
      if (x === stmt.x && y === stmt.y) return stmt;
      return { ...stmt, x, y };
    }

    case 'CircleDecl': {
      const cx = ox(stmt.cx), cy = ox(stmt.cy), r = ox(stmt.r);
      if (cx === stmt.cx && cy === stmt.cy && r === stmt.r) return stmt;
      return { ...stmt, cx, cy, r };
    }

    case 'LineDecl': {
      const slope     = oxopt(stmt.slope);
      const intercept = oxopt(stmt.intercept);
      const lhs       = oxopt(stmt.lhs);
      const rhs       = oxopt(stmt.rhs);
      const expr      = oxopt(stmt.expr);
      if (slope === stmt.slope && intercept === stmt.intercept &&
          lhs === stmt.lhs && rhs === stmt.rhs && expr === stmt.expr) return stmt;
      return { ...stmt, slope, intercept, lhs, rhs, expr };
    }

    case 'CurveDecl': {
      const start = ox(stmt.start), end = ox(stmt.end);
      const step = oxopt(stmt.step), body = ox(stmt.body);
      if (start === stmt.start && end === stmt.end && step === stmt.step && body === stmt.body) return stmt;
      return { ...stmt, start, end, step, body };
    }

    case 'TimeDecl': {
      const start = oxopt(stmt.start), end = oxopt(stmt.end), period = oxopt(stmt.period);
      if (start === stmt.start && end === stmt.end && period === stmt.period) return stmt;
      return { ...stmt, start, end, period };
    }

    case 'CameraDecl': {
      const azimuth = ox(stmt.azimuth), elevation = ox(stmt.elevation);
      if (azimuth === stmt.azimuth && elevation === stmt.elevation) return stmt;
      return { ...stmt, azimuth, elevation };
    }

    case 'RegionDecl': {
      const expr = ox(stmt.expr);
      return expr === stmt.expr ? stmt : { ...stmt, expr };
    }

    case 'PolygonDecl': {
      const points = mapKeep(stmt.points, p => ox(p) as T.Tuple);
      return points === stmt.points ? stmt : { ...stmt, points };
    }

    case 'SegmentDecl': {
      const p1 = ox(stmt.p1) as T.Tuple, p2 = ox(stmt.p2) as T.Tuple;
      if (p1 === stmt.p1 && p2 === stmt.p2) return stmt;
      return { ...stmt, p1, p2 };
    }

    case 'TextDecl': {
      const x = ox(stmt.x), y = ox(stmt.y);
      if (x === stmt.x && y === stmt.y) return stmt;
      return { ...stmt, x, y };
    }

    case 'GroupDecl':
      return stmt;

    case 'SpiralDecl': {
      const turns = ox(stmt.turns), spacing = ox(stmt.spacing);
      const cx = oxopt(stmt.cx), cy = oxopt(stmt.cy), rotate = oxopt(stmt.rotate);
      if (turns === stmt.turns && spacing === stmt.spacing &&
          cx === stmt.cx && cy === stmt.cy && rotate === stmt.rotate) return stmt;
      return { ...stmt, turns, spacing, cx, cy, rotate };
    }

    case 'WaveDecl': {
      const freq = ox(stmt.freq), amp = ox(stmt.amp);
      const phase = oxopt(stmt.phase), cx = oxopt(stmt.cx), cy = oxopt(stmt.cy);
      const xmin = oxopt(stmt.xmin), xmax = oxopt(stmt.xmax);
      if (freq === stmt.freq && amp === stmt.amp && phase === stmt.phase &&
          cx === stmt.cx && cy === stmt.cy && xmin === stmt.xmin && xmax === stmt.xmax) return stmt;
      return { ...stmt, freq, amp, phase, cx, cy, xmin, xmax };
    }

    case 'GridDecl': {
      const cols = ox(stmt.cols), rows = ox(stmt.rows);
      const xmin = oxopt(stmt.xmin), xmax = oxopt(stmt.xmax);
      const ymin = oxopt(stmt.ymin), ymax = oxopt(stmt.ymax);
      if (cols === stmt.cols && rows === stmt.rows &&
          xmin === stmt.xmin && xmax === stmt.xmax &&
          ymin === stmt.ymin && ymax === stmt.ymax) return stmt;
      return { ...stmt, cols, rows, xmin, xmax, ymin, ymax };
    }

    default:
      return stmt;
  }
}

function optimizeMap(map: T.MapExpr, env: Env): T.MapExpr {
  const start = optimizeExpr(map.range.start, env);
  const end   = optimizeExpr(map.range.end,   env);
  const step  = map.range.step ? optimizeExpr(map.range.step, env) : undefined;
  const body  = optimizeExpr(map.body, env);
  if (start === map.range.start && end === map.range.end && step === map.range.step && body === map.body) {
    return map;
  }
  const range = (start === map.range.start && end === map.range.end && step === map.range.step)
    ? map.range
    : { ...map.range, start, end, step };
  return { ...map, range, body };
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
      const folded = ((): T.Expr | null => {
        if (operand.type === 'NumLit') return num(-operand.value, expr.pos);
        if (operand.type === 'UnaryOp' && operand.op === '-') return operand.operand;
        return null;
      })();
      if (!folded) return operand === expr.operand ? expr : { ...expr, operand };
      note(
        env, operand.type === 'NumLit' ? 'fold' : 'identity', expr.pos,
        () => printShort({ ...expr, operand }), () => printShort(folded), depth,
      );
      return folded;
    }

    case 'BinOp': {
      const left  = ox(expr.left);
      const right = ox(expr.right);
      const source: T.Expr = (left === expr.left && right === expr.right)
        ? expr
        : { ...expr, left, right };

      if (left.type === 'NumLit' && right.type === 'NumLit') {
        const v = foldBinOp(expr.op, left.value, right.value);
        if (v !== null) {
          const folded = num(v, expr.pos);
          note(env, 'fold', expr.pos, () => printShort(source), () => printShort(folded), depth);
          return folded;
        }
      }

      const identity = ((): T.Expr | null => {
        switch (expr.op) {
          case '+':
            if (isZero(left))  return right;
            if (isZero(right)) return left;
            return null;
          case '-':
            if (isZero(right)) return left;
            if (isZero(left))  return { type: 'UnaryOp', op: '-', operand: right, pos: expr.pos };
            return null;
          case '*':
            if (isOne(left))   return right;
            if (isOne(right))  return left;
            if (isZero(left) || isZero(right)) return num(0, expr.pos);
            return null;
          case '/':
            if (isOne(right))  return left;
            if (isZero(left))  return num(0, expr.pos);
            return null;
          case '^':
            if (isOne(right))  return left;
            if (isZero(right)) return num(1, expr.pos);
            if (isZero(left))  return num(0, expr.pos);
            return null;
          default:
            return null;
        }
      })();

      if (!identity) return source;
      note(env, 'identity', expr.pos, () => printShort(source), () => printShort(identity), depth);
      return identity;
    }

    case 'CompareExpr': {
      const left = ox(expr.left), right = ox(expr.right);
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }

    case 'ConditionalExpr': {
      const cond = ox(expr.cond), then = ox(expr.then), else_ = ox(expr.else_);
      if (cond === expr.cond && then === expr.then && else_ === expr.else_) return expr;
      return { ...expr, cond, then, else_ };
    }

    case 'PiecewiseExpr': {
      const branches = mapKeep(expr.branches, b => {
        const cond = b.cond ? ox(b.cond) : null;
        const body = ox(b.body);
        return (cond === b.cond && body === b.body) ? b : { cond, body };
      });
      return branches === expr.branches ? expr : { ...expr, branches };
    }

    case 'Call': {
      const args = mapKeep(expr.args, a => ox(a));
      const kwargs = mapKwargs(expr.kwargs, v => ox(v));
      const same = args === expr.args && kwargs === expr.kwargs;

      if (BUILTINS.has(expr.fn)) return same ? expr : { ...expr, args, kwargs };

      const fn = lookupFn(env, expr.fn);
      if (fn) {
        if (args.length !== fn.params.length) {
          throw new Error(`'${expr.fn}' expects ${fn.params.length} argument(s), got ${args.length}`);
        }
        const inlined = inlineCall(fn, args, env, depth);
        note(
          env, 'inline', expr.pos,
          () => printShort(same ? expr : { ...expr, args, kwargs }), () => printShort(inlined), depth,
        );
        return inlined;
      }

      return same ? expr : { ...expr, args, kwargs };
    }

    case 'Tuple': {
      const x = ox(expr.x), y = ox(expr.y);
      if (x === expr.x && y === expr.y) return expr;
      return { ...expr, x, y };
    }

    case 'ListRange': {
      const start = ox(expr.start), end = ox(expr.end);
      const step  = expr.step ? ox(expr.step) : undefined;
      if (start === expr.start && end === expr.end && step === expr.step) return expr;
      return { ...expr, start, end, step };
    }

    case 'MapExpr':
      return optimizeMap(expr, env);

    case 'ForExpr': {
      const body  = ox(expr.body);
      const start = ox(expr.start), end = ox(expr.end);
      const step  = expr.step ? ox(expr.step) : undefined;
      if (body === expr.body && start === expr.start && end === expr.end && step === expr.step) return expr;
      return { ...expr, body, start, end, step };
    }
  }
}

const BUILTINS = new Set(['project', 'rgb', 'hsv', 'slider', ...ANIMATION_PRESETS]);

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
