// ast node types

export interface Pos {
  line: number;
  col: number;
}

export interface Program {
  type: 'Program';
  body: Statement[];
}

export type Statement =
  | VarDecl
  | AliasDecl
  | DebugDecl
  | ExprBlockDecl
  | PointDecl
  | CircleDecl
  | LineDecl
  | CurveDecl
  | RegionDecl
  | PolygonDecl
  | SegmentDecl
  | TextDecl
  | GroupDecl
  | FnDecl
  | SpiralDecl
  | WaveDecl
  | GridDecl;

/** a = expr [domain cond] */
export interface VarDecl {
  type: 'VarDecl';
  name: string;
  value: Expr;
  domain?: Expr;
  pos: Pos;
}

/** alias r = expr  — named binding, identical semantics to VarDecl */
export interface AliasDecl {
  type: 'AliasDecl';
  name: string;
  value: Expr;
  pos: Pos;
}

/** debug expr  — compile-time only, no output */
export interface DebugDecl {
  type: 'DebugDecl';
  expr: Expr;
  pos: Pos;
}

/** expr { x = cos(t)  y = sin(t)  (x, y) } */
export interface ExprBlockDecl {
  type: 'ExprBlockDecl';
  bindings: Array<{ name: string; value: Expr }>;
  result: Expr;
  pos: Pos;
}

/** point p (1, 2) [as { ... }] */
export interface PointDecl {
  type: 'PointDecl';
  name: string;
  x: Expr;
  y: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** circle c = circle((cx, cy), r) [as { ... }]
 *  OR  circle c { center (cx, cy)  radius r } [as { ... }] */
export interface CircleDecl {
  type: 'CircleDecl';
  name: string;
  cx: Expr;
  cy: Expr;
  r: Expr;
  style?: StyleBlock;
  pos: Pos;
}

export type LineForm = 'slope-intercept' | 'standard' | 'expr';

/** line l = slope(m), intercept(b)  |  line l = lhs = rhs  |  line l = expr */
export interface LineDecl {
  type: 'LineDecl';
  name: string;
  form: LineForm;
  slope?: Expr;
  intercept?: Expr;
  lhs?: Expr;
  rhs?: Expr;
  expr?: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** curve ring (t in 0..6.28 step 0.1) { (cos(t), sin(t)) } [as { ... }] */
export interface CurveDecl {
  type: 'CurveDecl';
  name: string;
  var: string;
  start: Expr;
  end: Expr;
  step?: Expr;
  body: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** region r = y > x^2 [as { ... }] */
export interface RegionDecl {
  type: 'RegionDecl';
  name: string;
  expr: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** polygon p = [(0,0), (2,0), (1,2)] [as { ... }] */
export interface PolygonDecl {
  type: 'PolygonDecl';
  name: string;
  points: Tuple[];
  style?: StyleBlock;
  pos: Pos;
}

/** segment s = (0,0) -> (2,3) [as { ... }] */
export interface SegmentDecl {
  type: 'SegmentDecl';
  name: string;
  p1: Tuple;
  p2: Tuple;
  style?: StyleBlock;
  pos: Pos;
}

/** text t = "hello" at (x, y) */
export interface TextDecl {
  type: 'TextDecl';
  name: string;
  content: string;
  x: Expr;
  y: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** group orbit as "Motion" */
export interface GroupDecl {
  type: 'GroupDecl';
  name: string;
  label: string;
  pos: Pos;
}

export interface StyleBlock {
  color?: Expr;
  gradient?: { from: Expr; to: Expr };
  opacity?: number;
  fill?: boolean;
  pointSize?: number;
  lineWidth?: number;
  lineOpacity?: number;
}

/** spiral s = spiral(turns=5, spacing=0.2) [as { ... }] */
export interface SpiralDecl {
  type: 'SpiralDecl';
  name: string;
  turns: Expr;
  spacing: Expr;
  cx?: Expr;
  cy?: Expr;
  rotate?: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** wave w = wave(freq=2, amp=1) [as { ... }] */
export interface WaveDecl {
  type: 'WaveDecl';
  name: string;
  freq: Expr;
  amp: Expr;
  phase?: Expr;
  cx?: Expr;
  cy?: Expr;
  xmin?: Expr;
  xmax?: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** grid g = grid(10, 10) [as { ... }] */
export interface GridDecl {
  type: 'GridDecl';
  name: string;
  cols: Expr;
  rows: Expr;
  xmin?: Expr;
  xmax?: Expr;
  ymin?: Expr;
  ymax?: Expr;
  style?: StyleBlock;
  pos: Pos;
}

export interface FnDecl {
  type: 'FnDecl';
  name: string;
  params: string[];
  body: Expr;
  pos: Pos;
}

export type Expr =
  | NumLit
  | StringLit
  | Ident
  | BinOp
  | UnaryOp
  | CompareExpr
  | ConditionalExpr
  | PiecewiseExpr
  | Call
  | Tuple
  | ListRange
  | MapExpr
  | ForExpr;

export interface NumLit {
  type: 'NumLit';
  value: number;
  pos: Pos;
}

export interface StringLit {
  type: 'StringLit';
  value: string;
  pos: Pos;
}

export interface Ident {
  type: 'Ident';
  name: string;
  pos: Pos;
}

export interface BinOp {
  type: 'BinOp';
  op: '+' | '-' | '*' | '/' | '^';
  left: Expr;
  right: Expr;
  /** written as juxtaposition (`2x`), so it renders without a product dot */
  implicit?: boolean;
  pos: Pos;
}

export interface UnaryOp {
  type: 'UnaryOp';
  op: '-';
  operand: Expr;
  pos: Pos;
}

export type CompareOp = '>' | '<' | '>=' | '<=' | '!=' | '==';

export interface CompareExpr {
  type: 'CompareExpr';
  op: CompareOp;
  left: Expr;
  right: Expr;
  pos: Pos;
}

export interface ConditionalExpr {
  type: 'ConditionalExpr';
  cond: Expr;
  then: Expr;
  else_: Expr;
  pos: Pos;
}

/** { cond: expr, ..., else: expr } — block piecewise */
export interface PiecewiseExpr {
  type: 'PiecewiseExpr';
  branches: Array<{ cond: Expr | null; body: Expr }>;
  pos: Pos;
}

export interface Call {
  type: 'Call';
  fn: string;
  args: Expr[];
  kwargs?: Record<string, Expr>;
  pos: Pos;
}

export interface Tuple {
  type: 'Tuple';
  x: Expr;
  y: Expr;
  pos: Pos;
}

export interface ListRange {
  type: 'ListRange';
  start: Expr;
  end: Expr;
  step?: Expr;
  pos: Pos;
}

/** map(i -> expr, start..end step n) */
export interface MapExpr {
  type: 'MapExpr';
  var: string;
  range: ListRange;
  body: Expr;
  pos: Pos;
}

export interface ForExpr {
  type: 'ForExpr';
  body: Expr;
  var: string;
  start: Expr;
  end: Expr;
  step?: Expr;
  pos: Pos;
}
