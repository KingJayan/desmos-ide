// per-phase and incremental compiler benchmarks
//   bun run bench            all sizes
//   bun run bench 500 2000   selected sizes

import { tokenize } from '../compiler/lexer';
import { parse } from '../compiler/parser';
import { analyze, createAnalyzeCache } from '../compiler/analyze';
import { optimize, collectAllRefs, createOptimizeCache, createRefsCache, type OptimizeNote } from '../compiler/optimizer';
import { codegenWithSourceMap, createCodegenCache } from '../compiler/codegen';
import { compile, type ReuseCache } from '../compile';
import { createParseCache, parseIncremental } from '../compiler/incremental-parse';
import { generate, applyEdit, EDIT_KINDS } from './gen';

const SIZES = process.argv.slice(2).map(Number).filter(n => n > 0);
const sizes = SIZES.length > 0 ? SIZES : [200, 1000, 4000];

function ms(n: number): string {
  return `${n.toFixed(2)}ms`.padStart(9);
}

/** median of `runs` timed calls after a warmup */
function time(runs: number, f: () => void): number {
  for (let i = 0; i < 3; i++) f();
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    f();
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function coldPhases(src: string): void {
  const tokens = tokenize(src);
  const ast = parse(tokens).ast;
  const refs = collectAllRefs(ast);
  const notes: OptimizeNote[] = [];
  const optimized = optimize(ast, notes, refs);

  const phases: [string, () => void][] = [
    ['tokenize', () => tokenize(src)],
    ['parse', () => parse(tokenize(src))],
    ['analyze', () => analyze(ast)],
    ['collectRefs', () => collectAllRefs(ast)],
    ['optimize', () => optimize(ast, [], refs)],
    ['codegen', () => codegenWithSourceMap(optimized)],
    ['compile (whole)', () => compile(src)],
  ];

  for (const [name, f] of phases) {
    console.log(`    ${name.padEnd(16)} ${ms(time(9, f))}`);
  }
}

interface Stats { hits: number; misses: number }

function rate(label: string, s: Stats): string {
  const total = s.hits + s.misses;
  return `${label} ${(total === 0 ? 0 : (100 * s.hits) / total).toFixed(0)}%`;
}

function incremental(src: string): void {
  for (const kind of EDIT_KINDS) {
    const parseCache = createParseCache();
    const reuse: ReuseCache = {
      analyze: createAnalyzeCache(),
      refs: createRefsCache(),
      optimize: createOptimizeCache(),
      codegen: createCodegenCache(),
    };
    const run = (s: string) => compile(s, { front: t => parseIncremental(t, parseCache), reuse });

    let cur = src;
    run(cur);

    let step = 0;
    const edit = () => {
      step++;
      cur = applyEdit(cur, kind, step);
      const r = run(cur);
      if (!r.success) throw new Error(`${kind}: ${r.errors[0].message}`);
    };

    const per = time(15, edit);
    const reuseRates = [
      rate('parse', parseCache),
      rate('opt', reuse.optimize),
      rate('gen', reuse.codegen),
    ].join('  ');
    console.log(`    ${kind.padEnd(16)} ${ms(per)}   reuse: ${reuseRates}`);
  }
}

for (const size of sizes) {
  const src = generate(size);
  console.log(`\n${'='.repeat(52)}\n${size} lines (${src.length} chars)\n${'='.repeat(52)}`);
  console.log('  cold:');
  coldPhases(src);
  console.log('  incremental (one edit per keystroke):');
  incremental(src);
}
console.log('');
