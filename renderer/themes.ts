/** the colour roles a theme fills, the same set the stylesheet holds in `$palettes` */
export interface Palette {
  base: string; mantle: string; crust: string;
  surface0: string; surface1: string;
  overlay0: string; overlay1: string; overlay2: string;
  subtext1: string; text: string;
  blue: string; green: string; yellow: string;
  red: string; mauve: string; peach: string;
  accent: string; accent2: string;
}

export interface ThemeSpec {
  id: string;
  label: string;
  axis: string;
  light: boolean;
  palette: Palette;
  /** the token roles this theme is known for, where they differ from the default mapping */
  tokens?: Partial<Record<string, keyof Palette>>;
}

export const THEMES = [
  { id: 'dsmx', label: 'dsmx dark', axis: '#5d6878', light: false,
    palette: { base: '#0e1420', mantle: '#0b1017', crust: '#06080c', surface0: '#1b2431', surface1: '#26313f', overlay0: '#6f7a8c', overlay1: '#9aa5b6', overlay2: '#b7c0cd', subtext1: '#d3dae4', text: '#edf2fa', blue: '#8cd7ff', green: '#7fe0b0', yellow: '#f0c58d', red: '#ff8f9c', mauve: '#c3b0ff', peach: '#f0c58d', accent: '#8cd7ff', accent2: '#f0c58d' } },
  { id: 'dsmx-light', label: 'dsmx light', axis: '#8b95a5', light: true,
    palette: { base: '#ffffff', mantle: '#f4f6fa', crust: '#e8ecf3', surface0: '#dfe4ec', surface1: '#cbd2de', overlay0: '#8b95a5', overlay1: '#6f7a8c', overlay2: '#55606f', subtext1: '#3b4453', text: '#141a24', blue: '#0b7ec4', green: '#12855f', yellow: '#9a6a12', red: '#c8384a', mauve: '#6d4ad1', peach: '#b06a1c', accent: '#0b7ec4', accent2: '#b06a1c' } },
  { id: 'catppuccin-mocha', label: 'catppuccin mocha', axis: '#7f849c', light: false,
    palette: { base: '#1e1e2e', mantle: '#181825', crust: '#11111b', surface0: '#313244', surface1: '#45475a', overlay0: '#6c7086', overlay1: '#7f849c', overlay2: '#9399b2', subtext1: '#bac2de', text: '#cdd6f4', blue: '#89b4fa', green: '#a6e3a1', yellow: '#f9e2af', red: '#f38ba8', mauve: '#cba6f7', peach: '#fab387', accent: '#cba6f7', accent2: '#fab387' } },
  { id: 'catppuccin-latte', label: 'catppuccin latte', axis: '#9ca0b0', light: true,
    palette: { base: '#eff1f5', mantle: '#e6e9ef', crust: '#dce0e8', surface0: '#ccd0da', surface1: '#bcc0cc', overlay0: '#9ca0b0', overlay1: '#8c8fa1', overlay2: '#7c7f93', subtext1: '#5c5f77', text: '#4c4f69', blue: '#1e66f5', green: '#40a02b', yellow: '#df8e1d', red: '#d20f39', mauve: '#8839ef', peach: '#fe640b', accent: '#8839ef', accent2: '#fe640b' } },
  { id: 'catppuccin-frappe', label: 'catppuccin frappé', axis: '#737994', light: false,
    palette: { base: '#303446', mantle: '#292c3c', crust: '#232634', surface0: '#414559', surface1: '#51576d', overlay0: '#737994', overlay1: '#838ba7', overlay2: '#949cbb', subtext1: '#b5bfe2', text: '#c6d0f5', blue: '#8caaee', green: '#a6d189', yellow: '#e5c890', red: '#e78284', mauve: '#ca9ee6', peach: '#ef9f76', accent: '#ca9ee6', accent2: '#ef9f76' } },
  { id: 'catppuccin-macchiato', label: 'catppuccin macchiato', axis: '#8087a2', light: false,
    palette: { base: '#24273a', mantle: '#1e2030', crust: '#181926', surface0: '#363a4f', surface1: '#494d64', overlay0: '#6e738d', overlay1: '#8087a2', overlay2: '#939ab7', subtext1: '#b8c0e0', text: '#cad3f5', blue: '#8aadf4', green: '#a6da95', yellow: '#eed49f', red: '#ed8796', mauve: '#c6a0f6', peach: '#f5a97f', accent: '#c6a0f6', accent2: '#f5a97f' } },
  { id: 'github-dark', label: 'github dark', axis: '#8b949e', light: false,
    palette: { base: '#0d1117', mantle: '#0b0f14', crust: '#010409', surface0: '#21262d', surface1: '#30363d', overlay0: '#6e7681', overlay1: '#8b949e', overlay2: '#a1a7b0', subtext1: '#c9d1d9', text: '#e6edf3', blue: '#58a6ff', green: '#3fb950', yellow: '#d29922', red: '#ff7b72', mauve: '#d2a8ff', peach: '#ffa657', accent: '#58a6ff', accent2: '#d2a8ff' },
    tokens: { keyword: 'red', 'function.builtin': 'mauve', 'function.call': 'mauve', number: 'blue', string: 'blue', 'string.quote': 'blue' } },
  { id: 'github-light', label: 'github light', axis: '#8c959f', light: true,
    palette: { base: '#ffffff', mantle: '#f6f8fa', crust: '#f3f4f6', surface0: '#d0d7de', surface1: '#afb8c1', overlay0: '#8c959f', overlay1: '#6e7781', overlay2: '#57606a', subtext1: '#3d444d', text: '#24292f', blue: '#0969da', green: '#1a7f37', yellow: '#9a6700', red: '#cf222e', mauve: '#8250df', peach: '#bc4c00', accent: '#0969da', accent2: '#8250df' },
    tokens: { keyword: 'red', 'function.builtin': 'mauve', 'function.call': 'mauve', number: 'blue', string: 'blue', 'string.quote': 'blue' } },
  { id: 'monokai', label: 'monokai', axis: '#90908a', light: false,
    palette: { base: '#272822', mantle: '#22231d', crust: '#1b1c17', surface0: '#3e3d32', surface1: '#49483e', overlay0: '#75715e', overlay1: '#90908a', overlay2: '#a6a69f', subtext1: '#c2c2bd', text: '#f8f8f2', blue: '#66d9ef', green: '#a6e22e', yellow: '#e6db74', red: '#f92672', mauve: '#ae81ff', peach: '#fd971f', accent: '#a6e22e', accent2: '#f92672' },
    tokens: { keyword: 'red', 'function.builtin': 'green', 'function.call': 'green', number: 'mauve', string: 'yellow', 'string.quote': 'yellow', 'delimiter.brace': 'red', 'delimiter.bracket': 'red', 'delimiter.parenthesis': 'red' } },
  { id: 'vs-dark', label: 'vs dark', axis: '#9da0a6', light: false,
    palette: { base: '#1e1e1e', mantle: '#252526', crust: '#181818', surface0: '#2d2d2d', surface1: '#3c3c3c', overlay0: '#7a7a7a', overlay1: '#9da0a6', overlay2: '#b0b4ba', subtext1: '#cccccc', text: '#d4d4d4', blue: '#569cd6', green: '#6a9955', yellow: '#dcdcaa', red: '#f44747', mauve: '#c586c0', peach: '#ce9178', accent: '#569cd6', accent2: '#c586c0' },
    tokens: { keyword: 'mauve', 'function.builtin': 'yellow', 'function.call': 'yellow', number: 'green', string: 'peach', 'string.quote': 'peach', comment: 'green' } },
  { id: 'vs-light', label: 'vs light', axis: '#949494', light: true,
    palette: { base: '#ffffff', mantle: '#f3f3f3', crust: '#e7e7e7', surface0: '#dddddd', surface1: '#cccccc', overlay0: '#888888', overlay1: '#666666', overlay2: '#4f4f4f', subtext1: '#3a3a3a', text: '#333333', blue: '#006ab1', green: '#008000', yellow: '#795e26', red: '#cd3131', mauve: '#af00db', peach: '#a31515', accent: '#006ab1', accent2: '#af00db' },
    tokens: { keyword: 'blue', 'function.builtin': 'yellow', 'function.call': 'yellow', number: 'green', string: 'peach', 'string.quote': 'peach', comment: 'green' } },
] as const satisfies readonly ThemeSpec[];

export type ColorTheme = typeof THEMES[number]['id'];

export const THEME_IDS: readonly ColorTheme[] = THEMES.map(t => t.id);

const BY_ID = new Map<string, ThemeSpec>(THEMES.map(t => [t.id, t]));

export function themeSpec(id: ColorTheme): ThemeSpec {
  return BY_ID.get(id) ?? THEMES[0];
}

export function isColorTheme(id: unknown): id is ColorTheme {
  return typeof id === 'string' && BY_ID.has(id);
}

/** a light theme needs a weaker fill to stay readable on white paper */
export function fillScale(id: ColorTheme): number {
  return themeSpec(id).light ? 0.55 : 1;
}

/** the grammar token names, each against the palette role that paints it */
const TOKEN_ROLES: readonly [string, keyof Palette, string?][] = [
  ['keyword',               'mauve', 'bold'],
  ['function.builtin',      'peach'],
  ['function.call',         'blue'],
  ['identifier',            'text'],
  ['number',                'red'],
  ['operator',              'blue'],
  ['operator.ellipsis',     'green', 'bold'],
  ['operator.arrow',        'green'],
  ['string',                'green'],
  ['string.quote',          'green'],
  ['comment',               'overlay0', 'italic'],
  ['delimiter',             'overlay2'],
  ['delimiter.brace',       'mauve'],
  ['delimiter.bracket',     'green'],
  ['delimiter.parenthesis', 'yellow'],
];

export interface MonacoTheme {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: { token: string; foreground: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

/** the editor colours come from the same palette as the graph and the chrome */
export function monacoTheme(id: ColorTheme): MonacoTheme {
  const spec = themeSpec(id);
  const p = spec.palette;
  return {
    base: spec.light ? 'vs' : 'vs-dark',
    inherit: true,
    rules: TOKEN_ROLES.map(([token, role, fontStyle]) => ({
      token,
      foreground: p[spec.tokens?.[token] ?? role].slice(1),
      ...(fontStyle ? { fontStyle } : {}),
    })),
    colors: {
      'editor.background':                   p.base,
      'editor.foreground':                   p.text,
      'editorLineNumber.foreground':         p.surface1,
      'editorLineNumber.activeForeground':   p.overlay1,
      'editor.selectionBackground':          p.surface1,
      'editor.selectionHighlightBackground':  p.surface0,
      'editor.wordHighlightBackground':       p.surface0,
      'editor.lineHighlightBackground':      p.mantle,
      'editorCursor.foreground':             p.accent,
      'editorIndentGuide.background1':       p.surface0,
      'editorIndentGuide.activeBackground1': p.surface1,
      'editorWhitespace.foreground':         p.surface0,
      'editorBracketMatch.background':       p.surface1,
      'editorBracketMatch.border':           p.accent,
      // monaco's bracket-pair colours default to gold and stay gold in every theme
      'editorBracketHighlight.foreground1':  p.yellow,
      'editorBracketHighlight.foreground2':  p.green,
      'editorBracketHighlight.foreground3':  p.mauve,
      'editorBracketHighlight.foreground4':  p.blue,
      'editorBracketHighlight.foreground5':  p.peach,
      'editorBracketHighlight.foreground6':  p.red,
      'editorBracketHighlight.unexpectedBracket.foreground': p.red,
    },
  };
}
