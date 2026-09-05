/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../renderer/${name}`, import.meta.url)), 'utf-8');

// the same rule lucide's createIcons uses to turn a table key into a data-lucide name
const kebab = (key: string): string =>
  key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

describe('the icons the markup asks for', () => {
  const html = read('index.html');
  const main = read('main.ts');
  const table = main.slice(main.indexOf('createIcons({'), main.indexOf('attrs:', main.indexOf('createIcons({')));
  const registered = new Set(table.match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? []);
  const wanted = new Set([...html.matchAll(/data-lucide="([a-z0-9-]+)"/g)].map(m => m[1]!));

  const named = new Set([...registered].map(kebab));

  test('every data-lucide name in index.html is registered with createIcons', () => {
    for (const name of wanted) {
      assert.ok(named.has(name), `${name} is not in the createIcons table`);
    }
  });

  test('the createIcons table carries nothing the markup never asks for', () => {
    for (const key of registered) {
      assert.ok(wanted.has(kebab(key)), `${key} is registered but no markup asks for it`);
    }
  });
});
