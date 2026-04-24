// public api

import { tokenize, LexError } from './compiler/lexer';
import { parse,    ParseError } from './compiler/parser';
import { optimize } from './compiler/optimizer';
import { codegen,  DesmosState, DesmosExpr } from './compiler/codegen';
import type { Program } from './compiler/types';

export { registerLanguage, LANGUAGE_ID, errorToMarker } from './monaco/language';
export type { DesmosState, DesmosExpr, DesmosSlider } from './compiler/codegen';
export type { DiagnosticMarker } from './monaco/language';

export type SymbolKind = 'let' | 'fn' | 'circle' | 'point' | 'line' | 'points';

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

export interface CompileFailure {
  success: false;
  error: string;
  line?: number;
  col?: number;
  tokenLen?: number;
}

export type CompileResult = CompileSuccess | CompileFailure;

function extractSymbols(ast: Program): SymbolInfo[] {
  return ast.body.map(stmt => {
    switch (stmt.type) {
      case 'LetDecl':    return { name: stmt.name, kind: 'let'    as const, line: stmt.pos.line, col: stmt.pos.col };
      case 'FnDecl':     return { name: stmt.name, kind: 'fn'     as const, line: stmt.pos.line, col: stmt.pos.col };
      case 'EntityDecl': return { name: stmt.name, kind: stmt.kind,         line: stmt.pos.line, col: stmt.pos.col };
      case 'ListDecl':   return { name: stmt.name, kind: 'points' as const, line: stmt.pos.line, col: stmt.pos.col };
    }
  });
}

const RESERVED = new Set(['t', 'r', 'theta']);

function checkWarnings(ast: Program): WarningMarker[] {
  const seen = new Map<string, number>();
  const markers: WarningMarker[] = [];
  for (const stmt of ast.body) {
    const name = stmt.name;
    const kw = stmt.type === 'LetDecl' ? 'let' : stmt.type === 'FnDecl' ? 'fn' : stmt.type === 'ListDecl' ? 'points' : (stmt as { kind: string }).kind;
    const col = stmt.pos.col;
    const line = stmt.pos.line;
    if (RESERVED.has(name)) {
      markers.push({
        startLineNumber: line,
        startColumn: col,
        endLineNumber: line,
        endColumn: col + kw.length + 1 + name.length,
        message: `'${name}' is a Desmos built-in — redeclaring it will break parametric/polar expressions`,
        severity: 4,
      });
    }
    if (seen.has(name)) {
      markers.push({
        startLineNumber: line,
        startColumn: col,
        endLineNumber: line,
        endColumn: col + kw.length + 1 + name.length,
        message: `'${name}' is already declared`,
        severity: 4,
      });
    } else {
      seen.set(name, line);
    }
  }
  return markers;
}

//core
export function compile(src: string): CompileResult {
  try {
    const tokens   = tokenize(src);
    const ast      = parse(tokens);
    const optimized = optimize(ast);
    const state    = codegen(optimized);
    const symbols  = extractSymbols(ast);
    const warnings = checkWarnings(ast);
    return { success: true, state, warnings, symbols };
  } catch (e) {
    if (e instanceof LexError) {
      return { success: false, error: e.message, line: e.line, col: e.col };
    }
    if (e instanceof ParseError) {
      return { success: false, error: e.message, line: e.tok.line, col: e.tok.col, tokenLen: e.tok.value.length };
    }
    return { success: false, error: String(e) };
  }
}

// util: return just the expr list
export function compileToList(src: string): DesmosExpr[] | null {
  const r = compile(src);
  return r.success ? r.state.expressions.list : null;
}
