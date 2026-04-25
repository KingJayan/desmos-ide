export const LANGUAGE_ID = 'desmos-dsl';

export const KEYWORDS = [
  'fn', 'in', 'map',
  'point', 'circle', 'line',
  'curve', 'region', 'polygon', 'segment',
  'text', 'group', 'as', 'at',
  'for', 'step', 'where', 'else',
  'time', 'project', 'camera',
] as const;

export const BUILTIN_FNS = [
  'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
  'ln', 'log', 'sqrt', 'abs', 'floor', 'ceil', 'round',
  'min', 'max', 'mod', 'sign',
  'rgb', 'hsv',
  'slider', 'time',
] as const;

export const languageConfig = {
  comments: { lineComment: '//' },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ] as [string, string][],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
  ],
  folding: {
    markers: {
      start: /^\s*\{/,
      end:   /^\s*\}/,
    },
  },
};

// monarch tokenizer

// Token classes:
//   kw          - let fn in map point circle line points time project camera
//   function.builtin - sin cos tan …
//   identifier       - user-defined names
//   number           - 3  3.14
//   operator         - + - * / ^ =
//   operator.ellipsis- ...
//   comment          - // …
//   delimiter.*      - { } [ ] ( ) , :

export const monarchTokens = {
  keywords:  [...KEYWORDS],
  builtins:  [...BUILTIN_FNS],

  tokenizer: {
    root: [
      [/\s+/, 'white'],

      [/\/\/.*$/, 'comment'],

      [/"/, { token: 'string.quote', next: '@string' }],

      [/\d+\.?\d*/, 'number'],

      [/\.\.\./, 'operator.ellipsis'],
      [/\.\./, 'operator.ellipsis'],
      [/->/, 'operator.arrow'],

      // function call sites (ident immediately followed by `(`)
      [
        /[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/,
        {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'function.builtin',
            '@default':  'function.call',
          },
        },
      ],

      // plain idents / keywords
      [
        /[a-zA-Z_][a-zA-Z0-9_]*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'function.builtin',
            '@default':  'identifier',
          },
        },
      ],

      [/[+\-*/^=<>!]/, 'operator'],

      [/[{}]/, 'delimiter.brace'],
      [/[\[\]]/, 'delimiter.bracket'],
      [/[()]/, 'delimiter.parenthesis'],

      [/[,:]/, 'delimiter'],
    ],

    string: [
      [/[^"]+/, 'string'],
      [/"/, { token: 'string.quote', next: '@pop' }],
    ],
  },
};


export const themeRules = [
  { token: 'keyword',               foreground: 'CBA6F7', fontStyle: 'bold'   }, // mauve
  { token: 'function.builtin',      foreground: 'FAB387'                       }, // peach
  { token: 'function.call',         foreground: '89B4FA'                       }, // blue — user fn calls
  { token: 'identifier',            foreground: 'CDD6F4'                       }, // text
  { token: 'number',                foreground: 'F38BA8'                       }, // red/rose — distinct from builtins
  { token: 'operator',              foreground: '89DCEB'                       }, // sky
  { token: 'operator.ellipsis',     foreground: 'A6E3A1', fontStyle: 'bold'   }, // green
  { token: 'operator.arrow',        foreground: 'A6E3A1'                       }, // green
  { token: 'string',                foreground: 'A6E3A1'                       }, // green
  { token: 'string.quote',          foreground: 'A6E3A1'                       }, // green
  { token: 'comment',               foreground: '6C7086', fontStyle: 'italic' }, // overlay0
  { token: 'delimiter',             foreground: '9399B2'                       }, // overlay2
  { token: 'delimiter.brace',       foreground: 'F5C2E7'                       }, // pink
  { token: 'delimiter.bracket',     foreground: 'A6E3A1'                       }, // green
  { token: 'delimiter.parenthesis', foreground: 'F9E2AF'                       }, // yellow
];

export const themeColors = {
  'editor.background':                '#1E1E2E', // base
  'editor.foreground':                '#CDD6F4', // text
  'editorLineNumber.foreground':      '#6C7086', // overlay0
  'editorLineNumber.activeForeground':'#BAC2DE', // subtext1
  'editor.selectionBackground':       '#313244', // surface0
  'editor.lineHighlightBackground':   '#181825', // mantle
  'editorCursor.foreground':          '#F5C2E7', // pink
  'editorBracketMatch.background':    '#45475A', // surface1
  'editorBracketMatch.border':        '#89B4FA', // blue
};


export interface CompletionItem {
  label: string;
  kind: number; // monaco.languages.CompletionItemKind value
  insertText: string;
  insertTextRules?: number; // 4 = InsertAsSnippet
  detail?: string;
  documentation?: string;
}

export function buildCompletions(kinds: {
  Keyword: number;
  Snippet: number;
  Function: number;
}): CompletionItem[] {
  const { Keyword, Snippet, Function } = kinds;

  return [

    {
      label: 'fn',
      kind: Snippet,
      insertText: 'fn ${1:name}(${2:x}) = ${3:body}',
      insertTextRules: 4,
      detail: 'inline function',
      documentation: 'Define a function — inlined at every call site during compilation.',
    },
    {
      label: 'point',
      kind: Snippet,
      insertText: 'point ${1:name} (${2:0}, ${3:0})',
      insertTextRules: 4,
      detail: 'labelled point',
      documentation: 'A labelled point at (x, y). Supports dynamic coordinates.',
    },
    {
      label: 'circle',
      kind: Snippet,
      insertText: 'circle ${1:name} = circle((${2:0}, ${3:0}), ${4:1})',
      insertTextRules: 4,
      detail: 'circle',
      documentation: 'Compiles to (x-h)²+(y-k)²=r².',
    },
    {
      label: 'line slope',
      kind: Snippet,
      insertText: 'line ${1:name} = slope(${2:1}), intercept(${3:0})',
      insertTextRules: 4,
      detail: 'line — slope-intercept',
    },
    {
      label: 'line standard',
      kind: Snippet,
      insertText: 'line ${1:name} = ${2:2*x + y} = ${3:4}',
      insertTextRules: 4,
      detail: 'line — standard form (lhs = rhs)',
    },
    {
      label: 'curve',
      kind: Snippet,
      insertText: 'curve ${1:name} (${2:t} in ${3:0}..${4:6.28}) {\n  (cos(${2:t}), sin(${2:t}))\n}',
      insertTextRules: 4,
      detail: 'parametric curve / sampled list',
      documentation: 'Tuple body → parametric curve with domain. Scalar body → list comprehension.',
    },
    {
      label: 'region',
      kind: Snippet,
      insertText: 'region ${1:name} = ${2:y > x^2}',
      insertTextRules: 4,
      detail: 'filled inequality region',
    },
    {
      label: 'polygon',
      kind: Snippet,
      insertText: 'polygon ${1:name} = [(${2:0},${3:0}), (${4:1},${5:0}), (${6:0},${7:1})]',
      insertTextRules: 4,
      detail: 'filled polygon',
    },
    {
      label: 'segment',
      kind: Snippet,
      insertText: 'segment ${1:name} = (${2:0},${3:0}) -> (${4:1},${5:1})',
      insertTextRules: 4,
      detail: 'line segment',
    },
    {
      label: 'text',
      kind: Snippet,
      insertText: 'text ${1:name} = "${2:label}" at (${3:0}, ${4:0})',
      insertTextRules: 4,
      detail: 'text label at position',
    },
    {
      label: 'group',
      kind: Snippet,
      insertText: 'group ${1:name} as "${2:Folder label}"',
      insertTextRules: 4,
      detail: 'Desmos folder',
    },
    {
      label: 'slider',
      kind: Snippet,
      insertText: '${1:a} = slider(${2:0}, ${3:0}, ${4:10})',
      insertTextRules: 4,
      detail: 'slider(initial, min, max)',
      documentation: 'Add speed=n kwarg to auto-play.',
    },
    {
      label: 'for-curve',
      kind: Snippet,
      insertText: '${1:pts} = ${2:(cos(t), sin(t))} for ${3:t} in ${4:0}..${5:6.28}',
      insertTextRules: 4,
      detail: 'inline for-comprehension curve',
    },
    {
      label: 'where',
      kind: Keyword,
      insertText: 'where',
      detail: 'conditional — expr where cond else alt',
    },

    ...KEYWORDS.map(kw => ({
      label: kw,
      kind: Keyword,
      insertText: kw,
      detail: 'keyword',
    })),

    ...BUILTIN_FNS.filter(fn => fn !== 'rgb' && fn !== 'hsv').map(fn => ({
      label: fn,
      kind: Function,
      insertText: `${fn}(\${1:x})`,
      insertTextRules: 4,
      detail: 'built-in function',
    })),

    {
      label: 'rgb',
      kind: Function,
      insertText: 'rgb(${1:255}, ${2:0}, ${3:0})',
      insertTextRules: 4,
      detail: 'color — rgb(r, g, b)',
      documentation: 'Desmos color via RGB (0–255 each). Shown as an inline color swatch.',
    },
    {
      label: 'hsv',
      kind: Function,
      insertText: 'hsv(${1:0}, ${2:1}, ${3:1})',
      insertTextRules: 4,
      detail: 'color — hsv(h, s, v)',
      documentation: 'Desmos color via HSV (h: 0–360, s/v: 0–1). Shown as an inline color swatch.',
    },
  ];
}


export interface DiagnosticMarker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 8 | 4; // 8 = Error, 4 = Warning
}

//monaco registration 

export interface DocumentSymbol {
  name: string;
  detail: string;
  kind: number;
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
  selectionRange: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
  tags: never[];
  children: never[];
}

export function registerLanguage(monaco: {
  languages: {
    register(opts: { id: string }): void;
    setLanguageConfiguration(id: string, config: unknown): void;
    setMonarchTokensProvider(id: string, tokens: unknown): void;
    registerCompletionItemProvider(
      id: string,
      provider: {
        provideCompletionItems(
          model: {
            getWordUntilPosition(pos: unknown): { startColumn: number; endColumn: number };
          },
          position: { lineNumber: number },
        ): { suggestions: unknown[] };
      },
    ): void;
    registerDocumentSymbolProvider(
      id: string,
      provider: {
        provideDocumentSymbols(
          model: { getValue(): string },
        ): DocumentSymbol[];
      },
    ): void;
    CompletionItemKind: {
      Keyword: number;
      Snippet: number;
      Function: number;
    };
    CompletionItemInsertTextRule: {
      InsertAsSnippet: number;
    };
    SymbolKind: {
      Variable: number;
      Function: number;
      Class: number;
      Constant: number;
      Module: number;
      Array: number;
    };
  };
  editor: {
    defineTheme(name: string, opts: unknown): void;
    setModelMarkers(model: unknown, owner: string, markers: DiagnosticMarker[]): void;
  };
}): void {
  monaco.languages.register({ id: LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, languageConfig);
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, monarchTokens);

  monaco.editor.defineTheme('desmos-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: themeRules,
    colors: themeColors,
  });

  const { Keyword, Snippet, Function } = monaco.languages.CompletionItemKind;
  const { InsertAsSnippet } = monaco.languages.CompletionItemInsertTextRule;

  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      };
      const completions = buildCompletions({ Keyword, Snippet, Function });
      const suggestions = completions.map(item => ({
        ...item,
        insertTextRules: item.insertTextRules === 4 ? InsertAsSnippet : undefined,
        range,
      }));
      return { suggestions };
    },
  });

  const { Variable, Function: Fn, Class, Constant, Module, Array: Arr } = monaco.languages.SymbolKind;
  const kindToSymbolKind: Record<string, number> = {
    fn: Fn, point: Constant, circle: Class, line: Module,
    curve: Arr, region: Arr, polygon: Arr, segment: Arr,
    text: Constant, group: Module,
  };
  const DECL_RE = /^(fn|point|circle|line|curve|region|polygon|segment|text|group)\s+([a-zA-Z_]\w*)|^([a-zA-Z_]\w*)\s*=/;

  monaco.languages.registerDocumentSymbolProvider(LANGUAGE_ID, {
    provideDocumentSymbols(model) {
      const lines = model.getValue().split('\n');
      const symbols: DocumentSymbol[] = [];
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(DECL_RE);
        if (!m) continue;
        const lineNum = i + 1;
        const kw   = m[1] ?? 'var';
        const name = m[2] ?? m[3];
        const nameCol = lines[i].indexOf(name) + 1;
        const nameEnd = nameCol + name.length;
        const range = { startLineNumber: lineNum, startColumn: 1, endLineNumber: lineNum, endColumn: lines[i].length + 1 };
        const sel   = { startLineNumber: lineNum, startColumn: nameCol, endLineNumber: lineNum, endColumn: nameEnd };
        symbols.push({ name, detail: kw, kind: kindToSymbolKind[kw] ?? Variable, range, selectionRange: sel, tags: [], children: [] });
      }
      return symbols;
    },
  });
}

// util: map compile errors to Monaco markers

export function errorToMarker(
  message: string,
  line: number,
  col: number,
  tokenLen = 1,
): DiagnosticMarker {
  return {
    startLineNumber: line,
    startColumn:     col,
    endLineNumber:   line,
    endColumn:       col + Math.max(1, tokenLen),
    message,
    severity: 8,
  };
}
