export interface ThemeSpec {
  id: string;
  label: string;
  background: string;
  axis: string;
  light: boolean;
}

export const THEMES = [
  { id: 'dsmx', label: 'dsmx Dark', background: '#0e1420', axis: '#5d6878', light: false },
  { id: 'dsmx-light', label: 'dsmx Light', background: '#ffffff', axis: '#8b95a5', light: true },
  { id: 'desmos-dark', label: 'Catppuccin Mocha', background: '#1e1e2e', axis: '#7f849c', light: false },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', background: '#eff1f5', axis: '#9ca0b0', light: true },
  { id: 'catppuccin-frappe', label: 'Catppuccin Frappé', background: '#303446', axis: '#737994', light: false },
  { id: 'catppuccin-macchiato', label: 'Catppuccin Macchiato', background: '#24273a', axis: '#8087a2', light: false },
  { id: 'github-dark', label: 'GitHub Dark', background: '#0d1117', axis: '#8b949e', light: false },
  { id: 'github-light', label: 'GitHub Light', background: '#ffffff', axis: '#8c959f', light: true },
  { id: 'monokai', label: 'Monokai', background: '#272822', axis: '#90908a', light: false },
  { id: 'vs-dark', label: 'VS Dark', background: '#1e1e1e', axis: '#9da0a6', light: false },
  { id: 'vs-light', label: 'VS Light', background: '#ffffff', axis: '#949494', light: true },
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
