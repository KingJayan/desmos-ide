/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEMES, fillScale, isColorTheme, themeSpec } from '../../renderer/themes';

const tokens = readFileSync(fileURLToPath(new URL('../../renderer/styles/_tokens.scss', import.meta.url)), 'utf-8');

function scssPalette(): Map<string, { base: string; light: boolean }> {
  const out = new Map<string, { base: string; light: boolean }>();
  const lightLine = /\$light-themes:([^;]+);/.exec(tokens)?.[1] ?? '';
  const light = new Set([...lightLine.matchAll(/'([^']+)'/g)].map(m => m[1]));
  for (const m of tokens.matchAll(/'([a-z0-9-]+)':\s*\(\s*\n\s*'base':\s*(#[0-9a-f]{6})/gi)) {
    out.set(m[1], { base: m[2].toLowerCase(), light: light.has(m[1]) });
  }
  return out;
}

describe('the theme table', () => {
  const palette = scssPalette();

  test('the stylesheet holds every theme the app offers', () => {
    assert.deepEqual([...palette.keys()].sort(), THEMES.map(t => t.id).sort());
  });

  test('the graph background is the same colour as the editor', () => {
    for (const theme of THEMES) {
      assert.equal(theme.background.toLowerCase(), palette.get(theme.id)?.base, theme.id);
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
