// the compiler pipelin with no editor imports

import { tokenize, LexError } from './compiler/lexer';
import { parse, ParseError, type ParseErrorInfo } from './compiler/parser';
import { needsMigration } from './compiler/migrate';
import { optimize, collectAllRefs, OptimizeNote, type OptimizeCache, type RefsCache, type RefSet } from './compiler/optimizer';
import { codegenWithSourceMap, ClockInfo, DesmosState, DesmosExpr, ExprSource, type CodegenCache } from './compiler/codegen';
import { analyze, type AnalyzeCache } from './compiler/analyze';
import { toTex, TexOptions, TexResult } from './compiler/tex';
import type { Program, Statement } from './compiler/types';

export type { TexOptions, TexResult, TexSkip, TexViewport } from './compiler/tex';

export type { DesmosState, DesmosExpr, DesmosSlider, ExprSource } from './compiler/codegen';

export type { OptimizeKind, OptimizeNote } from './compiler/optimizer';

export type SymbolKind =
  | 'var' | 'fn'
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
  sourceMap: ExprSource[];
  clock: ClockInfo | null;
  optimizations: OptimizeNote[];
  uses: string[];
}

interface Handoff { ast?: Program }

export interface ReuseCache {
  analyze: AnalyzeCache;
  refs: RefsCache;
  optimize: OptimizeCache;
  codegen: CodegenCache;
}

export interface CompileOptions {
  prelude?: string;
  available?: readonly string[];
  front?: (src: string) => { ast: Program; parseErrors: ParseErrorInfo[] };
  reuse?: ReuseCache;
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
  const out: SymbolInfo[] = [];
  for (const stmt of ast.body) {
    const sym = stmtSymbol(stmt);
    if (sym) out.push(sym);
  }
  return out;
}

const RESERVED = new Set(['t', 'r', 'theta']);

function checkWarnings(ast: Program, refs: RefSet): WarningMarker[] {
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

    if (kind === 'fn' && !refs.has(name)) {
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

let preludeMemo: { src: string; parsed: ReturnType<typeof parse> } | null = null;

function parsePrelude(src: string): ReturnType<typeof parse> {
  if (preludeMemo?.src !== src) preludeMemo = { src, parsed: parse(tokenize(src)) };
  return preludeMemo.parsed;
}

export function compile(src: string, opts: CompileOptions = {}, out?: Handoff): CompileResult {
  try {
    const { ast, parseErrors } = opts.front ? opts.front(src) : parse(tokenize(src));

    if (parseErrors.length > 0) {
      const legacy = needsMigration(src)
        ? 'This file uses the older grammar. Run "Migrate syntax" (dsmx fix) to update it.'
        : undefined;
      return {
        success: false,
        errors: parseErrors.map(e => mkError(e.error, 1, e.line, e.col, e.tokenLen, legacy)),
      };
    }

    const uses = ast.body.flatMap(s => (s.type === 'UseDecl' ? [s.plugin] : []));
    if (opts.available) {
      const have = new Set(opts.available);
      const missing = ast.body.filter(
        (s): s is Extract<Statement, { type: 'UseDecl' }> => s.type === 'UseDecl' && !have.has(s.plugin),
      );
      if (missing.length > 0) {
        return {
          success: false,
          errors: missing.map(s => mkError(
            `Plugin '${s.plugin}' is not installed`,
            2, s.pos.line, s.pos.col,
            undefined,
            'Install it from the marketplace, or delete this line',
          )),
        };
      }
    }

    const userAst = ast;
    const fromPlugin = new Set<string>();
    let program: Program = ast;
    if (opts.prelude) {
      const prelude = parsePrelude(opts.prelude);
      const contributed = prelude.ast.body.filter(
        (s): s is Extract<Statement, { type: 'FnDecl' | 'VarDecl' }> =>
          s.type === 'FnDecl' || s.type === 'VarDecl',
      );
      const asProgram: Program = { type: 'Program', body: contributed };
      if (prelude.parseErrors.length === 0 && analyze(asProgram).length === 0) {
        const declared = new Set(userAst.body.flatMap(s => {
          const sym = stmtSymbol(s);
          return sym ? [sym.name] : [];
        }));
        for (const s of contributed) {
          if (!declared.has(s.name)) fromPlugin.add(s.name);
        }
        program = { type: 'Program', body: [...contributed, ...ast.body] };
      }
    }

    const semanticErrors = analyze(program, opts.reuse?.analyze);
    if (semanticErrors.length > 0) {
      return {
        success: false,
        errors: semanticErrors.map(e => mkError(e.error, 2, e.line, e.col)),
      };
    }

    const optimizations: OptimizeNote[] = [];
    const usedRefs = collectAllRefs(program, opts.reuse?.refs);
    const optimized = optimize(program, optimizations, opts.reuse?.optimize);
    const drawn: Program = fromPlugin.size === 0
      ? optimized
      : { type: 'Program', body: optimized.body.filter(s => !('name' in s && fromPlugin.has(s.name))) };
    const { state, sourceMap, clock } = codegenWithSourceMap(drawn, opts.reuse?.codegen);
    const symbols   = extractSymbols(userAst);
    const warnings  = checkWarnings(userAst, usedRefs);

    if (out) out.ast = optimized;
    return { success: true, state, warnings, symbols, sourceMap, clock, optimizations, uses };
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
  const handoff: Handoff = {};
  const result = compile(src, {}, handoff);
  if (!result.success) return result;
  return { success: true, ...toTex(handoff.ast!, opts) };
}
