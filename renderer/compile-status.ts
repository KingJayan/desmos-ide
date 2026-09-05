import type { CompileError, CompileResult } from '../src/index';

export type StatusKind = 'success' | 'error' | 'info';

/**
 * the line the status bar shows for a compile
 */
export function compileStatus(result: CompileResult): { msg: string; kind: StatusKind } {
  if (result.success) {
    const count = result.state.expressions.list.length;
    const warnings = result.warnings.length;
    const note = warnings ? ` · ${warnings} warning${warnings === 1 ? '' : 's'}` : '';
    return { msg: `✓ ${count} expression${count === 1 ? '' : 's'}${note}`, kind: warnings ? 'info' : 'success' };
  }
  const first = result.errors[0];
  const msg = result.errors.length === 1
    ? `✗ ${first.message}`
    : `✗ ${result.errors.length} errors — ${first.message}`;
  return { msg, kind: 'error' };
}

/**
 * splits errors by phase
 */
export function errorsByPhase<T>(
  errors: readonly CompileError[],
  toMarker: (e: CompileError) => T | null,
): { syntax: T[]; semantic: T[] } {
  const pick = (phase: 1 | 2): T[] =>
    errors.filter(e => e.phase === phase).flatMap(e => {
      const marker = toMarker(e);
      return marker ? [marker] : [];
    });
  return { syntax: pick(1), semantic: pick(2) };
}
