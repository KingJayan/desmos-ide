
import { compile, type CompileOptions, type CompileResult, type ReuseCache } from './compile';
import { createParseCache, parseIncremental } from './compiler/incremental-parse';
import { createOptimizeCache, createRefsCache } from './compiler/optimizer';
import { createCodegenCache } from './compiler/codegen';
import { createAnalyzeCache } from './compiler/analyze';

export function createIncrementalCompiler(): (src: string, opts?: CompileOptions) => CompileResult {
  const parseCache = createParseCache();
  const reuse: ReuseCache = {
    analyze: createAnalyzeCache(),
    refs: createRefsCache(),
    optimize: createOptimizeCache(),
    codegen: createCodegenCache(),
  };
  return (src, opts = {}) =>
    compile(src, { ...opts, front: s => parseIncremental(s, parseCache), reuse });
}
