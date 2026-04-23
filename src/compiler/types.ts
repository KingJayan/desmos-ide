// AST node types for the Desmos DSL

export interface Pos {
  line: number;
  col: number;
}

// top-level

export interface Program {
  type: 'Program';
  body: Statement[];
}

export type Statement = LetDecl | FnDecl | EntityDecl | ListDecl;

export interface LetDecl {
  type: 'LetDecl';
  name: string;
  value: Expr;
  pos: Pos;
}

export interface FnDecl {
  type: 'FnDecl';
  name: string;
  params: string[];
  body: Expr;
  pos: Pos;
}

export type EntityKind = 'point' | 'circle' | 'line';

export interface EntityDecl {
  type: 'EntityDecl';
  kind: EntityKind;
  name: string;
  props: Record<string, Expr>;
  pos: Pos;
}

export interface ListDecl {
  type: 'ListDecl';
  name: string;
  map: MapExpr;
  pos: Pos;
}


export type Expr =
  | NumLit
  | Ident
  | BinOp
  | UnaryOp
  | Call
  | Tuple
  | ListRange
  | MapExpr
  | DomainExpr;

export interface NumLit {
  type: 'NumLit';
  value: number;
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
  pos: Pos;
}

export interface UnaryOp {
  type: 'UnaryOp';
  op: '-';
  operand: Expr;
  pos: Pos;
}

export interface Call {
  type: 'Call';
  fn: string;
  args: Expr[];
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

export interface MapExpr {
  type: 'MapExpr';
  var: string;
  range: ListRange;
  body: Expr;
  pos: Pos;
}

export type AnimMethod = 'static' | 'play' | 'loop';

export interface DomainExpr {
  type: 'DomainExpr';
  start: Expr;
  end: Expr;
  method: AnimMethod;
  loopDir: 1 | -1;
  pos: Pos;
}
