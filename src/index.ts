// public api

import { tokenize, LexError } from './compiler/lexer';
import { parse, ParseError } from './compiler/parser';
import { optimize } from './compiler/optimizer';
import { codegenWithSourceMap, ClockInfo, DesmosState, DesmosExpr, ExprSource } from './compiler/codegen';
import { analyze } from './compiler/analyze';
import { toTex, TexOptions, TexResult } from './compiler/tex';
import type { Program, Statement, Expr } from './compiler/types';

export type { TexOptions, TexResult, TexSkip, TexViewport } from './compiler/tex';

export { registerLanguage, LANGUAGE_ID, errorToMarker } from './monaco/language';
export type { DesmosState, DesmosExpr, DesmosSlider, ExprSource } from './compiler/codegen';
export type { DiagnosticMarker } from './monaco/language';

export type SymbolKind =
  | 'var' | 'fn' | 'alias'
  | 'point' | 'circle' | 'line'
  | 'curve' | 'region' | 'polygon' | 'segment'
  | 'text' | 'group'
  | 'spiral' | 'wave' | 'grid' | 'time' | 'camera';

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  line: number;
  col: number;
}

export interface WarningMarker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 4;
}

export interface CompileSuccess {
  success: true;
  state: DesmosState;
  warnings: WarningMarker[];
  symbols: SymbolInfo[];
  /** maps each graph expression back to the statement that produced it */
  sourceMap: ExprSource[];
  /** the clock the transport drives, or null when the source declares no `time` */
  clock: ClockInfo | null;
}

export interface CompileError {
  message: string;
  phase: 1 | 2;
  line?: number;
  col?: number;
  endCol?: number;
  fix?: string;
  error: string;
}

export interface CompileFailure {
  success: false;
  errors: CompileError[];
}

export type CompileResult = CompileSuccess | CompileFailure;

function stmtSymbol(stmt: Statement): SymbolInfo | null {
  const p = stmt.pos;
  switch (stmt.type) {
    case 'VarDecl':    return { name: stmt.name, kind: 'var',     line: p.line, col: p.col };
    case 'AliasDecl':  return { name: stmt.name, kind: 'alias',   line: p.line, col: p.col };
    case 'FnDecl':     return { name: stmt.name, kind: 'fn',      line: p.line, col: p.col };
    case 'PointDecl':  return { name: stmt.name, kind: 'point',   line: p.line, col: p.col };
    case 'CircleDecl': return { name: stmt.name, kind: 'circle',  line: p.line, col: p.col };
    case 'LineDecl':   return { name: stmt.name, kind: 'line',    line: p.line, col: p.col };
    case 'CurveDecl':  return { name: stmt.name, kind: 'curve',   line: p.line, col: p.col };
    case 'RegionDecl': return { name: stmt.name, kind: 'region',  line: p.line, col: p.col };
    case 'PolygonDecl':return { name: stmt.name, kind: 'polygon', line: p.line, col: p.col };
    case 'SegmentDecl':return { name: stmt.name, kind: 'segment', line: p.line, col: p.col };
    case 'TextDecl':   return { name: stmt.name, kind: 'text',    line: p.line, col: p.col };
    case 'GroupDecl':  return { name: stmt.name, kind: 'group',   line: p.line, col: p.col };
    case 'SpiralDecl': return { name: stmt.name, kind: 'spiral',  line: p.line, col: p.col };
    case 'WaveDecl':   return { name: stmt.name, kind: 'wave',    line: p.line, col: p.col };
    case 'GridDecl':   return { name: stmt.name, kind: 'grid',    line: p.line, col: p.col };
    case 'TimeDecl':   return { name: stmt.name, kind: 'time',    line: p.line, col: p.col };
    case 'CameraDecl': return { name: stmt.name, kind: 'camera',  line: p.line, col: p.col };
    default:           return null;
  }
}

function extractSymbols(ast: Program): SymbolInfo[] {
  return ast.body.flatMap(stmt => {
    const sym = stmtSymbol(stmt);
    return sym ? [sym] : [];
  });
}

const RESERVED = new Set(['t', 'r', 'theta']);

function collectRefs(expr: Expr, out: Set<string>): void {
  switch (expr.type) {
    case 'Ident': out.add(expr.name); break;
    case 'BinOp': collectRefs(expr.left, out); collectRefs(expr.right, out); break;
    case 'UnaryOp': collectRefs(expr.operand, out); break;
    case 'CompareExpr': collectRefs(expr.left, out); collectRefs(expr.right, out); break;
    case 'ConditionalExpr': collectRefs(expr.cond, out); collectRefs(expr.then, out); collectRefs(expr.else_, out); break;
    case 'PiecewiseExpr': expr.branches.forEach(b => { if (b.cond) collectRefs(b.cond, out); collectRefs(b.body, out); }); break;
    case 'Call': out.add(expr.fn); expr.args.forEach(a => collectRefs(a, out)); if (expr.kwargs) Object.values(expr.kwargs).forEach(v => collectRefs(v, out)); break;
    case 'Tuple': collectRefs(expr.x, out); collectRefs(expr.y, out); break;
    case 'ListRange': collectRefs(expr.start, out); collectRefs(expr.end, out); if (expr.step) collectRefs(expr.step, out); break;
    case 'MapExpr': collectRefs(expr.range, out); collectRefs(expr.body, out); break;
    case 'ForExpr': collectRefs(expr.start, out); collectRefs(expr.end, out); if (expr.step) collectRefs(expr.step, out); collectRefs(expr.body, out); break;
  }
}

function allRefs(ast: Program): Set<string> {
  const refs = new Set<string>();
  for (const stmt of ast.body) {
    switch (stmt.type) {
      case 'VarDecl':     collectRefs(stmt.value, refs); if (stmt.domain) collectRefs(stmt.domain, refs); break;
      case 'AliasDecl':   collectRefs(stmt.value, refs); break;
      case 'FnDecl':      collectRefs(stmt.body, refs); break;
      case 'DebugDecl':   collectRefs(stmt.expr, refs); break;
      case 'ExprBlockDecl': stmt.bindings.forEach(b => collectRefs(b.value, refs)); collectRefs(stmt.result, refs); break;
      case 'PointDecl':   collectRefs(stmt.x, refs); collectRefs(stmt.y, refs); break;
      case 'CircleDecl':  collectRefs(stmt.cx, refs); collectRefs(stmt.cy, refs); collectRefs(stmt.r, refs); break;
      case 'LineDecl':    [stmt.slope, stmt.intercept, stmt.lhs, stmt.rhs, stmt.expr].forEach(e => e && collectRefs(e, refs)); break;
      case 'CurveDecl':   collectRefs(stmt.start, refs); collectRefs(stmt.end, refs); if (stmt.step) collectRefs(stmt.step, refs); collectRefs(stmt.body, refs); break;
      case 'RegionDecl':  collectRefs(stmt.expr, refs); break;
      case 'PolygonDecl': stmt.points.forEach(p => { collectRefs(p.x, refs); collectRefs(p.y, refs); }); break;
      case 'SegmentDecl': collectRefs(stmt.p1.x, refs); collectRefs(stmt.p1.y, refs); collectRefs(stmt.p2.x, refs); collectRefs(stmt.p2.y, refs); break;
      case 'TextDecl':    collectRefs(stmt.x, refs); collectRefs(stmt.y, refs); break;
      case 'SpiralDecl':  collectRefs(stmt.turns, refs); collectRefs(stmt.spacing, refs); [stmt.cx, stmt.cy, stmt.rotate].forEach(e => e && collectRefs(e, refs)); break;
      case 'WaveDecl':    [stmt.freq, stmt.amp, stmt.phase, stmt.cx, stmt.cy, stmt.xmin, stmt.xmax].forEach(e => e && collectRefs(e, refs)); break;
      case 'GridDecl':    [stmt.cols, stmt.rows, stmt.xmin, stmt.xmax, stmt.ymin, stmt.ymax].forEach(e => e && collectRefs(e, refs)); break;
    }
  }
  return refs;
}

function checkWarnings(ast: Program): WarningMarker[] {
  const seen = new Map<string, number>();
  const markers: WarningMarker[] = [];
  const refs = allRefs(ast);

  for (const stmt of ast.body) {
    const sym = stmtSymbol(stmt);
    if (!sym) continue;
    const { name, kind, line, col } = sym;
    const kwLen = kind.length;

    if (RESERVED.has(name)) {
      markers.push({
        startLineNumber: line, startColumn: col,
        endLineNumber: line,   endColumn: col + kwLen + 1 + name.length,
        message: `'${name}' is a Desmos built-in — redeclaring it will break parametric/polar expressions`,
        severity: 4,
      });
    }
    if (seen.has(name)) {
      markers.push({
        startLineNumber: line, startColumn: col,
        endLineNumber: line,   endColumn: col + kwLen + 1 + name.length,
        message: `'${name}' is already declared`,
        severity: 4,
      });
    } else {
      seen.set(name, line);
    }

    if ((kind === 'alias' || kind === 'fn') && !refs.has(name)) {
      markers.push({
        startLineNumber: line, startColumn: col,
        endLineNumber: line,   endColumn: col + kwLen + 1 + name.length,
        message: `'${name}' is declared but never used`,
        severity: 4,
      });
    }
  }
  return markers;
}

function stripPrefix(raw: string): string {
  // strip "[line:col] Foo error: " prefix
  return raw.replace(/^\[\d+:\d+\] \w[\w ]+:\s*/, '');
}

function mkError(raw: string, phase: 1 | 2, line?: number, col?: number, tokenLen?: number, fix?: string): CompileError {
  const message = stripPrefix(raw);
  return { error: raw, message, phase, line, col, endCol: (col != null && tokenLen) ? col + tokenLen : undefined, fix };
}

export function compile(src: string): CompileResult {
  try {
    const tokens = tokenize(src);
    const { ast, parseErrors } = parse(tokens);

    if (parseErrors.length > 0) {
      return {
        success: false,
        errors: parseErrors.map(e => mkError(e.error, 1, e.line, e.col, e.tokenLen)),
      };
    }

    const semanticErrors = analyze(ast);
    if (semanticErrors.length > 0) {
      return {
        success: false,
        errors: semanticErrors.map(e => mkError(e.error, 2, e.line, e.col)),
      };
    }

    const optimized = optimize(ast);
    const { state, sourceMap, clock } = codegenWithSourceMap(optimized);
    const symbols   = extractSymbols(ast);
    const warnings  = checkWarnings(ast);

    return { success: true, state, warnings, symbols, sourceMap, clock };
  } catch (e) {
    if (e instanceof LexError)
      return { success: false, errors: [mkError(e.message, 1, e.line, e.col)] };
    if (e instanceof ParseError)
      return { success: false, errors: [mkError(e.message, 1, e.tok.line, e.tok.col, e.tok.value.length)] };
    return { success: false, errors: [{ error: String(e), message: String(e), phase: 1 }] };
  }
}

export function compileToList(src: string): DesmosExpr[] | null {
  const r = compile(src);
  return r.success ? r.state.expressions.list : null;
}

export type TexSuccess = { success: true } & TexResult;

export function compileToTex(src: string, opts: TexOptions = {}): TexSuccess | CompileFailure {
  const result = compile(src);
  if (!result.success) return result;

  const { ast } = parse(tokenize(src));
  return { success: true, ...toTex(optimize(ast), opts) };
}
