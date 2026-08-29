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
  | DebugDecl
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
  | GridDecl
  | TimeDecl
  | CameraDecl
  | UseDecl;

/** [kind] a = expr [where cond] */
export interface VarDecl {
  type: 'VarDecl';
  name: string;
  value: Expr;
  domain?: Expr;
  pos: Pos;
}

/** use "plugin-id": names a plugin the file needs, no output */
export interface UseDecl {
  type: 'UseDecl';
  plugin: string;
  pos: Pos;
}

/** debug expr: compile-time only, no output */
export interface DebugDecl {
  type: 'DebugDecl';
  expr: Expr;
  pos: Pos;
}

/** point p = (1, 2) [as { ... }] */
export interface PointDecl {
  type: 'PointDecl';
  name: string;
  x: Expr;
  y: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** circle c = circle(center=(cx, cy), radius=r) [as { ... }] */
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

/** line l = line(slope=m, intercept=b)  |  line l = lhs == rhs  |  line l = expr */
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

/** curve ring = curve(t -> (cos(t), sin(t)), 0..6.28 step 0.1) [as { ... }] */
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

/** polygon p = polygon([(0,0), (2,0), (1,2)]) [as { ... }] */
export interface PolygonDecl {
  type: 'PolygonDecl';
  name: string;
  points: Tuple[];
  style?: StyleBlock;
  pos: Pos;
}

/** segment s = segment((0,0), (2,3)) [as { ... }] */
export interface SegmentDecl {
  type: 'SegmentDecl';
  name: string;
  p1: Tuple;
  p2: Tuple;
  style?: StyleBlock;
  pos: Pos;
}

/** text t = text("hello", at=(x, y)) */
export interface TextDecl {
  type: 'TextDecl';
  name: string;
  content: string;
  x: Expr;
  y: Expr;
  style?: StyleBlock;
  pos: Pos;
}

/** group orbit = group("Motion") */
export interface GroupDecl {
  type: 'GroupDecl';
  name: string;
  label: string;
  pos: Pos;
}

export interface StyleBlock {
  color?: Expr;
  gradient?: { from: Expr; to: Expr };
  opacity?: Expr;
  fill?: boolean;
  pointSize?: Expr;
  lineWidth?: Expr;
  lineOpacity?: Expr;
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

/** how the clock behaves when it reaches the end of its range */
export type TimeMode = 'loop' | 'mirror';

/** time T = time(0..10, period=2000, mode=loop) — the one clock the graph animates on */
export interface TimeDecl {
  type: 'TimeDecl';
  name: string;
  start?: Expr;
  end?: Expr;
  /** milliseconds for one sweep of the range */
  period?: Expr;
  mode?: TimeMode;
  pos: Pos;
}

/** camera cam = camera(azimuth=0.6, elevation=0.4) — the angles project() reads */
export interface CameraDecl {
  type: 'CameraDecl';
  name: string;
  azimuth: Expr;
  elevation: Expr;
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
  | ListLit
  | ListRange
  | Lambda
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

/** [a, b, c] */
export interface ListLit {
  type: 'ListLit';
  items: Expr[];
  pos: Pos;
}

/** t -> expr, only legal where a builtin takes a function */
export interface Lambda {
  type: 'Lambda';
  param: string;
  body: Expr;
  pos: Pos;
}

export interface ListRange {
  type: 'ListRange';
  start: Expr;
  end: Expr;
  step?: Expr;
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
