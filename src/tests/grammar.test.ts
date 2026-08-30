/// <reference types="node" />
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'fs/promises';
import { join } from 'path';
import * as oniguruma from 'vscode-oniguruma';
import * as textmate from 'vscode-textmate';
import { KEYWORDS } from '../compiler/lexer';
import { BUILTIN_NAMES, CONSTRUCTOR_NAMES, STYLE_FNS } from '../compiler/builtins';

const ROOT = join(import.meta.dirname, '..', '..');
const GRAMMAR = join(ROOT, 'editors', 'vscode', 'syntaxes', 'desmos-dsl.tmLanguage.json');

let grammar: textmate.IGrammar;

before(async () => {
  const wasm = await readFile(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer as ArrayBuffer);

  const registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (sources: string[]) => new oniguruma.OnigScanner(sources),
      createOnigString: (s: string) => new oniguruma.OnigString(s),
    }),
    loadGrammar: async () =>
      textmate.parseRawGrammar(await readFile(GRAMMAR, 'utf-8'), GRAMMAR),
  });

  const loaded = await registry.loadGrammar('source.dsmx');
  assert.ok(loaded, 'the grammar failed to load');
  grammar = loaded;
});

function scopeOf(line: string, text: string): string {
  const at = line.indexOf(text);
  assert.ok(at !== -1, `"${text}" is not in "${line}"`);
  const { tokens } = grammar.tokenizeLine(line, textmate.INITIAL);
  const token = tokens.find(t => t.startIndex <= at && at < t.endIndex);
  assert.ok(token, `no token covers "${text}"`);
  return token.scopes[token.scopes.length - 1];
}

describe('the grammar loads', () => {
  test('every pattern is valid oniguruma', () => {
    const source = [
      '// a comment',
      'x = 3',
      'a = slider(0, 0, 10)',
      'fn f(a, b) = a + b',
      'point p = (1, 2)',
      'curve ring = curve(t -> (cos(t), sin(t)), 0..6.28)',
      'text lbl = text("hello", at=(1, 2))',
      'v = if x > 0 then x^2 else -x^2',
      'z = { x > 0: x^2, else: 0 }',
      'polygon tri = polygon([(0,0), (1,0), (0,1)])',
      'segment s = segment((0,0), (1,1))',
      'point p2 = (0, 0) as { color: red, pointSize: 12 }',
      'alpha = 1',
    ];
    let state = textmate.INITIAL;
    for (const line of source) {
      const result = grammar.tokenizeLine(line, state);
      assert.ok(result.tokens.length > 0, line);
      state = result.ruleStack;
    }
  });
});

describe('token classes', () => {
  test('comments', () => {
    assert.equal(scopeOf('// note', '// note'), 'comment.line.double-slash.dsmx');
  });

  test('strings', () => {
    assert.equal(scopeOf('text l = text("hi", at=(0,0))', 'hi'), 'string.quoted.double.dsmx');
  });

  test('numbers, including scientific notation', () => {
    assert.equal(scopeOf('x = 3.14', '3.14'), 'constant.numeric.dsmx');
    assert.equal(scopeOf('x = 1e5', '1e5'), 'constant.numeric.dsmx');
  });

  test('keywords', () => {
    assert.equal(scopeOf('v = if a then b else c', 'if'), 'keyword.control.dsmx');
    assert.equal(scopeOf('y = x^2 where x > 0', 'where'), 'keyword.control.dsmx');
  });

  test('a type annotation reads as the constructor it names', () => {
    assert.equal(scopeOf('point p = (0, 0)', 'point'), 'support.function.dsmx');
    assert.equal(scopeOf('curve c = curve(t -> t, 0..1)', 'curve'), 'support.function.dsmx');
  });

  test('builtins', () => {
    assert.equal(scopeOf('y = sin(x)', 'sin'), 'support.function.dsmx');
    assert.equal(scopeOf('a = slider(0, 0, 1)', 'slider'), 'support.function.dsmx');
  });

  test('a user function call is not a builtin', () => {
    assert.equal(scopeOf('y = myFn(x)', 'myFn'), 'entity.name.function.dsmx');
  });

  test('a plain name is a variable', () => {
    assert.equal(scopeOf('y = width', 'width'), 'variable.other.dsmx');
  });

  test('greek letters are identifiers', () => {
    assert.equal(scopeOf('y = α', 'α'), 'variable.other.dsmx');
  });

  test('operators and ranges', () => {
    assert.equal(scopeOf('y = a + b', '+'), 'keyword.operator.dsmx');
    assert.equal(scopeOf('y = a >= b', '>='), 'keyword.operator.comparison.dsmx');
    assert.equal(scopeOf('curve c = curve(t -> t, 0..1)', '..'), 'keyword.operator.range.dsmx');
    assert.equal(scopeOf('l = map(t -> t, 0..1)', '->'), 'keyword.operator.arrow.dsmx');
  });
});

describe('the grammar tracks the compiler tables', () => {
  test('every keyword is highlighted as one', async () => {
    for (const kw of KEYWORDS) {
      assert.equal(scopeOf(`${kw} `, kw), 'keyword.control.dsmx', kw);
    }
  });

  test('every builtin the lexer does not claim is highlighted as a function', () => {
    const names = [...BUILTIN_NAMES, ...CONSTRUCTOR_NAMES, ...STYLE_FNS.map(f => f.name)];
    for (const name of names) {
      if (KEYWORDS.has(name)) continue;
      assert.equal(scopeOf(`y = ${name}(x)`, name), 'support.function.dsmx', name);
    }
  });

  test('the checked-in grammar is what the generator writes now', async () => {
    const before = await readFile(GRAMMAR, 'utf-8');
    const proc = Bun.spawnSync(['bun', 'run', join(ROOT, 'scripts', 'build-grammar.ts')], { cwd: ROOT });
    assert.equal(proc.exitCode, 0, new TextDecoder().decode(proc.stderr));
    assert.equal(await readFile(GRAMMAR, 'utf-8'), before, 'run `bun run build:grammar` and commit the result');
  });
});
