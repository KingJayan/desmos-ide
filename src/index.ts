// public api

import { tokenize, LexError } from './compiler/lexer';
import { parse,    ParseError } from './compiler/parser';
import { optimize } from './compiler/optimizer';
import { codegen,  DesmosState, DesmosExpr } from './compiler/codegen';

export { registerLanguage, LANGUAGE_ID, errorToMarker } from './monaco/language';
export type { DesmosState, DesmosExpr, DesmosSlider } from './compiler/codegen';
export type { DiagnosticMarker } from './monaco/language';


export interface CompileSuccess {
  success: true;
  state: DesmosState;
  warnings: string[];
}

export interface CompileFailure {
  success: false;
  error: string;
  line?: number;
  col?: number;
}

export type CompileResult = CompileSuccess | CompileFailure;

//core
export function compile(src: string): CompileResult {
  try {
    const tokens   = tokenize(src);
    const ast      = parse(tokens);
    const optimized = optimize(ast);
    const state    = codegen(optimized);
    return { success: true, state, warnings: [] };
  } catch (e) {
    if (e instanceof LexError) {
      return { success: false, error: e.message, line: e.line, col: e.col };
    }
    if (e instanceof ParseError) {
      return { success: false, error: e.message, line: e.tok.line, col: e.tok.col };
    }
    return { success: false, error: String(e) };
  }
}

// util: return just the expr list
export function compileToList(src: string): DesmosExpr[] | null {
  const r = compile(src);
  return r.success ? r.state.expressions.list : null;
}
