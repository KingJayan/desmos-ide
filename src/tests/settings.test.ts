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

const { loadSettings, settingsFromJson, settingsToJson, UI_SCALES, GROUPS, DEFAULTS } =
  await import('../../renderer/settings');

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

describe('settings.json', () => {
  beforeEach(() => store.clear());

  test('what the app writes it reads back unchanged', () => {
    const written = settingsToJson(loadSettings());
    assert.deepEqual(settingsFromJson(written), loadSettings());
  });

  test('a file the user edited by hand is taken key by key', () => {
    const next = settingsFromJson('{"fontSize": 18, "wordWrap": "on"}');
    assert.equal(next?.fontSize, 18);
    assert.equal(next?.wordWrap, 'on');
    assert.equal(next?.uiScale, 'default');
  });

  test('a value out of range is clamped, not obeyed', () => {
    assert.equal(settingsFromJson('{"fontSize": 400}')?.fontSize, 24);
    assert.equal(settingsFromJson('{"fontSize": 1}')?.fontSize, 10);
    assert.equal(settingsFromJson('{"lineNumbers": "sometimes"}')?.lineNumbers, 'on');
  });

  test('a file that is not an object is refused, so the app keeps what it has', () => {
    assert.equal(settingsFromJson('{ not json'), null);
    assert.equal(settingsFromJson('[]'), null);
    assert.equal(settingsFromJson('7'), null);
  });

  test('every field the panel offers is a key of the file', () => {
    const written = JSON.parse(settingsToJson(loadSettings())) as Record<string, unknown>;
    for (const group of GROUPS) {
      for (const field of group.fields) {
        assert.ok(field.key in written, `${field.key} is not written to settings.json`);
      }
    }
  });

  test('a select takes only what its own options list', () => {
    for (const group of GROUPS) {
      for (const field of group.fields) {
        if (field.kind !== 'select' || 'numeric' in field) continue;
        const bad = settingsFromJson(JSON.stringify({ [field.key]: 'nonsense-value' }));
        assert.equal(bad?.[field.key], DEFAULTS[field.key], field.key);
        for (const option of field.options) {
          const next = settingsFromJson(JSON.stringify({ [field.key]: option.value }));
          assert.equal(next?.[field.key], option.value, `${field.key}=${option.value}`);
        }
      }
    }
  });

  test('a toggle refuses anything that is not a boolean', () => {
    for (const group of GROUPS) {
      for (const field of group.fields) {
        if (field.kind !== 'toggle') continue;
        for (const bad of ['true', 1, null, {}]) {
          const next = settingsFromJson(JSON.stringify({ [field.key]: bad }));
          assert.equal(next?.[field.key], DEFAULTS[field.key], `${field.key} took ${JSON.stringify(bad)}`);
        }
        const flipped = settingsFromJson(JSON.stringify({ [field.key]: !DEFAULTS[field.key] }));
        assert.equal(flipped?.[field.key], !DEFAULTS[field.key], field.key);
      }
    }
  });

  test('simple mode is off until it is asked for', () => {
    assert.equal(loadSettings().simpleMode, false);
    assert.equal(settingsFromJson('{"simpleMode": true}')?.simpleMode, true);
  });

  test('the tour flag lives in the file, so the tour can be asked for again', () => {
    assert.equal(loadSettings().tourDone, false);
    assert.equal(settingsFromJson('{"tourDone": true}')?.tourDone, true);
  });
});
