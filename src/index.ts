// public api — DSL v2

import { tokenize, LexError } from './compiler/lexer';
import { parse, ParseError } from './compiler/parser';
import { optimize } from './compiler/optimizer';
import { codegen,  DesmosState, DesmosExpr } from './compiler/codegen';
import type { Program, Statement } from './compiler/types';

export { registerLanguage, LANGUAGE_ID, errorToMarker } from './monaco/language';
export type { DesmosState, DesmosExpr, DesmosSlider } from './compiler/codegen';
export type { DiagnosticMarker } from './monaco/language';

export type SymbolKind =
  | 'var' | 'fn'
  | 'point' | 'circle' | 'line'
  | 'curve' | 'region' | 'polygon' | 'segment'
  | 'text' | 'group';

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
}

export interface CompileError {
  error: string;
  line?: number;
  col?: number;
  tokenLen?: number;
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

function checkWarnings(ast: Program): WarningMarker[] {
  const seen = new Map<string, number>();
  const markers: WarningMarker[] = [];

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
  }
  return markers;
}

export function compile(src: string): CompileResult {
  try {
    const tokens = tokenize(src);
    const { ast, parseErrors } = parse(tokens);
    const optimized = optimize(ast);
    const state     = codegen(optimized);
    const symbols   = extractSymbols(ast);
    const warnings  = checkWarnings(ast);
    if (parseErrors.length > 0) {
      return { success: false, errors: parseErrors };
    }
    return { success: true, state, warnings, symbols };
  } catch (e) {
    if (e instanceof LexError)  return { success: false, errors: [{ error: e.message, line: e.line, col: e.col }] };
    if (e instanceof ParseError) return { success: false, errors: [{ error: e.message, line: e.tok.line, col: e.tok.col, tokenLen: e.tok.value.length }] };
    return { success: false, errors: [{ error: String(e) }] };
  }
}

export function compileToList(src: string): DesmosExpr[] | null {
  const r = compile(src);
  return r.success ? r.state.expressions.list : null;
}
