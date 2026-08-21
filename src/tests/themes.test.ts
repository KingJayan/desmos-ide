/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEMES, fillScale, isColorTheme, monacoTheme, themeSpec } from '../../renderer/themes';

const tokens = readFileSync(fileURLToPath(new URL('../../renderer/styles/_tokens.scss', import.meta.url)), 'utf-8');

interface ScssTheme { light: boolean; roles: Record<string, string> }

function scssPalette(): Map<string, ScssTheme> {
  const out = new Map<string, ScssTheme>();
  const lightLine = /\$light-themes:([^;]+);/.exec(tokens)?.[1] ?? '';
  const light = new Set([...lightLine.matchAll(/'([^']+)'/g)].map(m => m[1]));
  const body = tokens.slice(tokens.indexOf('$palettes:'), tokens.indexOf('$default-theme'));
  for (const m of body.matchAll(/'([a-z0-9-]+)':\s*\(([\s\S]*?)\n {2}\)/g)) {
    const roles: Record<string, string> = {};
    for (const r of m[2].matchAll(/'([a-z0-9]+)':\s*(#[0-9a-f]{6})/gi)) roles[r[1]] = r[2].toLowerCase();
    out.set(m[1], { light: light.has(m[1]), roles });
  }
  return out;
}

describe('the theme table', () => {
  const palette = scssPalette();

  test('the stylesheet holds every theme the app offers', () => {
    assert.deepEqual([...palette.keys()].sort(), THEMES.map(t => t.id).sort());
  });

  test('the table and the stylesheet hold the same colours', () => {
    for (const theme of THEMES) {
      assert.deepEqual({ ...theme.palette }, palette.get(theme.id)?.roles, theme.id);
    }
  });

  test('the editor gets its colours from the same palette as the graph', () => {
    for (const theme of THEMES) {
      const editor = monacoTheme(theme.id);
      assert.equal(editor.colors['editor.background'], theme.palette.base, theme.id);
      assert.equal(editor.colors['editor.foreground'], theme.palette.text, theme.id);
      assert.equal(editor.base, theme.light ? 'vs' : 'vs-dark', theme.id);
      for (const rule of editor.rules) assert.match(rule.foreground, /^[0-9a-f]{6}$/, theme.id);
    }
  });

  test('a theme is light in one place only', () => {
    for (const theme of THEMES) {
      assert.equal(theme.light, palette.get(theme.id)?.light, theme.id);
    }
  });

  test('only a light theme weakens the fill', () => {
    for (const theme of THEMES) {
      assert.equal(fillScale(theme.id), theme.light ? 0.55 : 1, theme.id);
    }
  });

  test('an unknown theme id is refused and falls back', () => {
    assert.equal(isColorTheme('solarized'), false);
    assert.equal(themeSpec('solarized' as never).id, 'dsmx');
  });
});
