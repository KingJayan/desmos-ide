// writes the textmate grammar and the vs code language configuration from the
// compiler tables, so a fifth consumer of builtins.ts can never drift from the
// analyzer, the monarch grammar, the completions or the quick look extension.
//
//   bun run build:grammar

import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { KEYWORDS } from '../src/compiler/lexer';
import { BUILTIN_NAMES, STYLE_FNS } from '../src/compiler/builtins';
import { languageConfig } from '../src/monaco/language';
import { iconPng } from './vsix-icon';

const ROOT = join(import.meta.dir, '..');
const OUT_DIR = join(ROOT, 'editors', 'vscode');
const SCOPE = 'source.dsmx';

// greek letters are ordinary identifier characters, the way the lexer treats them
const IDENT_START = 'a-zA-Z_\\u03b1-\\u03c9';
const IDENT = `[${IDENT_START}][${IDENT_START}0-9]*`;

/** longest first, so no keyword can be shadowed by a shorter one it starts with */
const alternation = (names: readonly string[]) =>
  [...new Set(names)].sort((a, b) => b.length - a.length || a.localeCompare(b)).join('|');

const KEYWORD_RE = `\\b(?:${alternation([...KEYWORDS])})\\b`;
const BUILTIN_RE = `\\b(?:${alternation([...BUILTIN_NAMES, ...STYLE_FNS.map(f => f.name)])})\\b`;

const grammar = {
  $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
  name: 'Desmos DSL',
  scopeName: SCOPE,
  fileTypes: ['dsmx'],
  // keywords win over builtins because the lexer resolves an identifier that way:
  // `polygon` and `project` are both, and the keyword decides how the line parses
  patterns: [
    { include: '#comment' },
    { include: '#string' },
    { include: '#number' },
    { include: '#keyword' },
    { include: '#builtin' },
    { include: '#call' },
    { include: '#operator' },
    { include: '#punctuation' },
    { include: '#identifier' },
  ],
  repository: {
    comment: {
      name: 'comment.line.double-slash.dsmx',
      match: '//.*$',
    },
    string: {
      name: 'string.quoted.double.dsmx',
      begin: '"',
      end: '"',
      beginCaptures: { 0: { name: 'punctuation.definition.string.begin.dsmx' } },
      endCaptures: { 0: { name: 'punctuation.definition.string.end.dsmx' } },
    },
    number: {
      name: 'constant.numeric.dsmx',
      match: '(?:\\b\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?\\b',
    },
    keyword: {
      name: 'keyword.control.dsmx',
      match: KEYWORD_RE,
    },
    builtin: {
      name: 'support.function.dsmx',
      match: BUILTIN_RE,
    },
    call: {
      name: 'entity.name.function.dsmx',
      match: `${IDENT}(?=\\s*\\()`,
    },
    operator: {
      patterns: [
        { name: 'keyword.operator.range.dsmx', match: '\\.\\.\\.|\\.\\.' },
        { name: 'keyword.operator.arrow.dsmx', match: '->' },
        { name: 'keyword.operator.comparison.dsmx', match: '>=|<=|!=|==' },
        { name: 'keyword.operator.dsmx', match: '[+\\-*/^=<>!]' },
      ],
    },
    punctuation: {
      patterns: [
        { name: 'punctuation.section.braces.dsmx', match: '[{}]' },
        { name: 'punctuation.section.brackets.dsmx', match: '[\\[\\]]' },
        { name: 'punctuation.section.parens.dsmx', match: '[()]' },
        { name: 'punctuation.separator.dsmx', match: '[,:]' },
      ],
    },
    identifier: {
      name: 'variable.other.dsmx',
      match: IDENT,
    },
  },
};

// the same brackets and pairs monaco is given, so both editors behave alike
const languageConfiguration = {
  comments: languageConfig.comments,
  brackets: languageConfig.brackets,
  autoClosingPairs: languageConfig.autoClosingPairs,
  surroundingPairs: languageConfig.surroundingPairs,
  folding: {
    markers: {
      start: languageConfig.folding.markers.start.source,
      end: languageConfig.folding.markers.end.source,
    },
  },
};

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { version: string };
const REPO = 'https://github.com/KingJayan/desmos-ide';

const manifest = {
  name: 'desmos-dsl',
  displayName: 'Desmos DSL',
  description: 'Syntax highlighting for the dsmx language.',
  version: pkg.version,
  publisher: 'kingjayan',
  license: 'Apache-2.0',
  icon: 'icon.png',
  galleryBanner: { color: '#11111b', theme: 'dark' },
  homepage: `${REPO}#readme`,
  repository: { type: 'git', url: `${REPO}.git`, directory: 'editors/vscode' },
  bugs: { url: `${REPO}/issues` },
  keywords: ['desmos', 'dsmx', 'graphing', 'math'],
  engines: { vscode: '^1.75.0' },
  categories: ['Programming Languages'],
  contributes: {
    languages: [{
      id: 'desmos-dsl',
      aliases: ['Desmos DSL', 'dsmx'],
      extensions: ['.dsmx'],
      configuration: './language-configuration.json',
    }],
    grammars: [{
      language: 'desmos-dsl',
      scopeName: SCOPE,
      path: './syntaxes/desmos-dsl.tmLanguage.json',
    }],
  },
};

const HEADER = { _generated: 'by scripts/build-grammar.ts from the compiler tables — do not edit' };

const write = async (path: string, value: object) =>
  writeFile(path, `${JSON.stringify({ ...HEADER, ...value }, null, 2)}\n`);

const README = `# Desmos DSL

syntax highlighting and bracket behaviour for \`.dsmx\` files.
(from [desmos-ide](${REPO}))

grammar is generated from the compiler tables

## what it provides

- syntax highlighting for kws, builtins, calls, nums, strs and comments
- comment toggling, bracket matching, auto-closing pairs and folding markers

for compilation, graph preview, and optimizer, use desmos-ide app or
the \`dsmx\` cli.
`;

const VSCODE_IGNORE = `.vscode/**
**/*.map
`;

await mkdir(join(OUT_DIR, 'syntaxes'), { recursive: true });
await writeFile(join(OUT_DIR, 'README.md'), README);
await writeFile(join(OUT_DIR, 'LICENSE'), await readFile(join(ROOT, 'LICENSE'), 'utf8'));
await writeFile(join(OUT_DIR, '.vscodeignore'), VSCODE_IGNORE);
await writeFile(join(OUT_DIR, 'icon.png'), iconPng());
await write(join(OUT_DIR, 'syntaxes', 'desmos-dsl.tmLanguage.json'), grammar);
await write(join(OUT_DIR, 'language-configuration.json'), languageConfiguration);
await write(join(OUT_DIR, 'package.json'), manifest);

console.log(`build-grammar: ${[...KEYWORDS].length} keywords, ${BUILTIN_NAMES.length + STYLE_FNS.length} builtins`);
