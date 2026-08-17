import type { CompileResult } from '../compile';
import { toSourceLine } from './macro';

export function remapResult(result: CompileResult, lineMap: number[]): CompileResult {
  const at = (line: number) => toSourceLine(lineMap, line);

  if (!result.success) {
    return {
      success: false,
      errors: result.errors.map(e => (e.line === undefined ? e : { ...e, line: at(e.line) })),
    };
  }

  return {
    ...result,
    warnings: result.warnings.map(w => ({
      ...w,
      startLineNumber: at(w.startLineNumber),
      endLineNumber: at(w.endLineNumber),
    })),
    symbols: result.symbols.map(s => ({ ...s, line: at(s.line) })),
    sourceMap: result.sourceMap.map(e => ({ ...e, line: at(e.line) })),
    optimizations: result.optimizations.map(n => ({ ...n, line: at(n.line) })),
  };
}
