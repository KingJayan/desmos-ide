/// <reference types="node" />
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'dsmx-config-'));
process.env.DSMX_HOME = home;

const { configPath, ensureConfig, readConfig, unwatchConfig, writeConfig } =
  await import('../../bun/config');

after(() => {
  unwatchConfig();
  rmSync(home, { recursive: true, force: true });
});

describe('the config files', () => {
  test('a missing file reads as an empty one instead of an error', async () => {
    const settings = await readConfig('settings');
    assert.equal(settings.content.trim(), '{}');
    const keybinds = await readConfig('keybinds');
    assert.equal(keybinds.content.trim(), '[]');
  });

  test('both files live under the store the app owns', () => {
    assert.equal(configPath('settings'), join(home, 'settings.json'));
    assert.equal(configPath('keybinds'), join(home, 'keybinds.json'));
  });

  test('a first run leaves both files on disk', async () => {
    await ensureConfig();
    assert.equal((await readFile(configPath('settings'), 'utf-8')).trim(), '{}');
    assert.equal((await readFile(configPath('keybinds'), 'utf-8')).trim(), '[]');
  });

  test('what is written is what is read', async () => {
    assert.equal(await writeConfig('settings', '{"fontSize":18}\n'), true);
    assert.equal((await readConfig('settings')).content, '{"fontSize":18}\n');
  });

  test('a payload too large for a settings file is refused', async () => {
    assert.equal(await writeConfig('settings', 'x'.repeat(300 * 1024)), false);
    assert.equal((await readConfig('settings')).content, '{"fontSize":18}\n');
  });
});
