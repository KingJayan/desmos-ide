/// <reference types="node" />
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// settings.ts reads localStorage at module scope on load, so the stub goes up first
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
};

const { loadSettings, UI_SCALES } = await import('../../renderer/settings');

const KEY = 'desmos-ide-settings';

function stored(raw: unknown): void {
  store.set(KEY, JSON.stringify(raw));
}

describe('the interface size setting', () => {
  beforeEach(() => store.clear());

  test('a fresh install gets the middle size', () => {
    assert.equal(loadSettings().uiScale, 'default');
  });

  test('each offered size survives a round trip', () => {
    for (const scale of UI_SCALES) {
      stored({ uiScale: scale });
      assert.equal(loadSettings().uiScale, scale, scale);
    }
  });

  test('a value the panel never offers falls back instead of reaching the dom', () => {
    for (const bad of ['huge', '', 13, null, {}]) {
      stored({ uiScale: bad });
      assert.equal(loadSettings().uiScale, 'default', JSON.stringify(bad));
    }
  });

  test('settings saved before the size existed still load', () => {
    stored({ colorTheme: 'github-light', fontSize: 15 });
    const s = loadSettings();
    assert.equal(s.uiScale, 'default');
    // the rest of the file is not lost on the way
    assert.equal(s.colorTheme, 'github-light');
    assert.equal(s.fontSize, 15);
  });

  test('a broken settings file does not stop the app starting', () => {
    store.set(KEY, '{ not json');
    assert.equal(loadSettings().uiScale, 'default');
  });
});

describe('the autosave setting', () => {
  beforeEach(() => store.clear());

  test('is off until it is asked for', () => {
    assert.equal(loadSettings().autosave, false);
  });

  test('a settings file written before it existed does not turn it on', () => {
    stored({ colorTheme: 'github-light' });
    assert.equal(loadSettings().autosave, false);
  });

  test('survives a round trip', () => {
    stored({ autosave: true });
    assert.equal(loadSettings().autosave, true);
  });

  test('a non-boolean value falls back instead of writing files', () => {
    for (const bad of ['true', 1, null, {}]) {
      stored({ autosave: bad });
      assert.equal(loadSettings().autosave, false, JSON.stringify(bad));
    }
  });
});
