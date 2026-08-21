/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const {
  DEFAULT_KEYBINDS, Keymap, chordLabel, chordOf, keybindsToJson, normalizeChord, parseKeybinds,
} = await import('../../renderer/keybinds');

const press = (init: {
  key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean;
}): KeyboardEvent => ({
  key: init.key,
  metaKey: !!init.metaKey,
  ctrlKey: !!init.ctrlKey,
  altKey: !!init.altKey,
  shiftKey: !!init.shiftKey,
} as KeyboardEvent);

describe('a chord is written one way', () => {
  test('the modifier order never depends on how it was typed', () => {
    assert.equal(normalizeChord('shift+cmd+P'), 'cmd+shift+p');
    assert.equal(normalizeChord('cmd+shift+p'), 'cmd+shift+p');
  });

  test('the names other editors use are accepted', () => {
    assert.equal(normalizeChord('Meta+S'), 'cmd+s');
    assert.equal(normalizeChord('Command+S'), 'cmd+s');
    assert.equal(normalizeChord('Control+Option+R'), 'ctrl+alt+r');
  });

  test('a rule with no key, or with two, is refused', () => {
    assert.equal(normalizeChord('cmd'), null);
    assert.equal(normalizeChord('cmd+a+b'), null);
    assert.equal(normalizeChord(''), null);
  });

  test('an event and a rule meet in the same spelling', () => {
    assert.equal(chordOf(press({ key: 'P', metaKey: true, shiftKey: true })), 'cmd+shift+p');
    assert.equal(chordOf(press({ key: 'F1' })), 'f1');
  });

  test('a modifier alone is not a chord', () => {
    assert.equal(chordOf(press({ key: 'Shift', shiftKey: true })), null);
  });

  test('the label is what the palette shows', () => {
    assert.equal(chordLabel('cmd+shift+p'), '⌘⇧P');
    assert.equal(chordLabel('cmd+alt+r'), '⌘⌥R');
    assert.equal(chordLabel('f1'), 'f1');
  });
});

describe('keybinds.json', () => {
  test('a file that is not a list of rules leaves the defaults alone', () => {
    assert.equal(parseKeybinds('{'), null);
    assert.equal(parseKeybinds('{"key":"cmd+k"}'), null);
  });

  test('one bad rule does not cost the good ones', () => {
    const rules = parseKeybinds('[{"key":"cmd+k","command":"file.new"},{"key":"cmd"},{"nope":1}]');
    assert.deepEqual(rules, [{ key: 'cmd+k', command: 'file.new' }]);
  });

  test('the written file reads back the same', () => {
    const rules = parseKeybinds(keybindsToJson(DEFAULT_KEYBINDS));
    assert.deepEqual(rules, DEFAULT_KEYBINDS.map(r => ({ key: r.key, command: r.command })));
  });
});

describe('the keymap', () => {
  test('the defaults are in force with no user file', () => {
    const map = new Keymap();
    assert.equal(map.commandFor('cmd+shift+p'), 'palette.toggle');
    assert.equal(map.commandFor('cmd+s'), 'file.save');
    assert.equal(map.commandFor('cmd+k'), null);
  });

  test('a user rule takes the chord from the default', () => {
    const map = new Keymap();
    map.apply([{ key: 'cmd+s', command: 'file.saveas' }]);
    assert.equal(map.commandFor('cmd+s'), 'file.saveas');
  });

  test('a rule with no command unbinds the chord', () => {
    const map = new Keymap();
    map.apply([{ key: 'cmd+shift+p', command: '-' }]);
    assert.equal(map.commandFor('cmd+shift+p'), null);
  });

  test('the palette shows the key that is actually bound', () => {
    const map = new Keymap();
    map.apply([{ key: 'cmd+alt+n', command: 'file.new' }]);
    assert.equal(map.labelFor('file.new'), '⌘N');
    map.apply([{ key: 'cmd+n', command: '-' }, { key: 'cmd+alt+n', command: 'file.new' }]);
    assert.equal(map.labelFor('file.new'), '⌘⌥N');
  });

  test('a command with no chord has no label', () => {
    assert.equal(new Keymap().labelFor('compile.run'), null);
  });
});
