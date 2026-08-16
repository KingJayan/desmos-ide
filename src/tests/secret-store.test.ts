/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SecretStore } from '../../renderer/secret-store';
import type { SecretPorts } from '../../renderer/secret-store';

const ACCOUNTS = ['openai-compatible', 'github-copilot'];

function ports(opts: { available?: boolean; keychain?: Record<string, string>; legacy?: Record<string, string> } = {}) {
  const keychain: Record<string, string> = { ...(opts.keychain ?? {}) };
  let legacy: Record<string, string> = { ...(opts.legacy ?? {}) };
  let cleared = false;

  const p: SecretPorts = {
    available: async () => opts.available ?? true,
    get: async a => keychain[a] ?? null,
    set: async (a, v) => { keychain[a] = v; return true; },
    remove: async a => { delete keychain[a]; return true; },
    legacy: () => legacy,
    clearLegacy: () => { legacy = {}; cleared = true; },
  };
  return { p, keychain, wasCleared: () => cleared, legacyNow: () => legacy };
}

describe('with a keychain', () => {
  test('reads what the keychain holds', async () => {
    const { p } = ports({ keychain: { 'openai-compatible': 'sk-stored' } });
    const s = new SecretStore(p, ACCOUNTS);
    await s.load();
    assert.equal(s.secure, true);
    assert.equal(s.get('openai-compatible'), 'sk-stored');
  });

  test('moves a plaintext key into the keychain and erases it', async () => {
    const h = ports({ legacy: { 'openai-compatible': 'sk-old' } });
    const s = new SecretStore(h.p, ACCOUNTS);
    await s.load();
    assert.equal(h.keychain['openai-compatible'], 'sk-old');
    assert.equal(s.get('openai-compatible'), 'sk-old');
    assert.equal(h.wasCleared(), true);
    assert.deepEqual(h.legacyNow(), {});
  });

  test('a plaintext key never overwrites a newer keychain key', async () => {
    const h = ports({
      keychain: { 'openai-compatible': 'sk-current' },
      legacy: { 'openai-compatible': 'sk-stale' },
    });
    const s = new SecretStore(h.p, ACCOUNTS);
    await s.load();
    assert.equal(s.get('openai-compatible'), 'sk-current');
    assert.equal(h.keychain['openai-compatible'], 'sk-current');
  });

  test('erases the plaintext copy even when there is nothing to move', async () => {
    const h = ports({ keychain: { 'openai-compatible': 'sk-current' }, legacy: { 'openai-compatible': 'sk-current' } });
    const s = new SecretStore(h.p, ACCOUNTS);
    await s.load();
    assert.equal(h.wasCleared(), true);
  });

  test('a saved key goes to the keychain, not to disk', async () => {
    const h = ports();
    const s = new SecretStore(h.p, ACCOUNTS);
    await s.load();
    await s.set('github-copilot', 'gho_token');
    assert.equal(h.keychain['github-copilot'], 'gho_token');
    assert.deepEqual(s.plaintext(), {});
  });

  test('clearing a key removes it from the keychain', async () => {
    const h = ports({ keychain: { 'github-copilot': 'gho_token' } });
    const s = new SecretStore(h.p, ACCOUNTS);
    await s.load();
    await s.set('github-copilot', '');
    assert.equal('github-copilot' in h.keychain, false);
    assert.equal(s.get('github-copilot'), '');
  });

  test('trims what it is given', async () => {
    const h = ports();
    const s = new SecretStore(h.p, ACCOUNTS);
    await s.load();
    await s.set('openai-compatible', '  sk-padded  ');
    assert.equal(s.get('openai-compatible'), 'sk-padded');
  });

  test('loads once, however many callers ask', async () => {
    let calls = 0;
    const h = ports();
    const counting = { ...h.p, available: async () => { calls++; return true; } };
    const s = new SecretStore(counting, ACCOUNTS);
    await Promise.all([s.load(), s.load(), s.load()]);
    assert.equal(calls, 1);
  });
});

describe('without a keychain', () => {
  test('falls back to the plaintext keys rather than losing them', async () => {
    const h = ports({ available: false, legacy: { 'openai-compatible': 'sk-old' } });
    const s = new SecretStore(h.p, ACCOUNTS);
    await s.load();
    assert.equal(s.secure, false);
    assert.equal(s.get('openai-compatible'), 'sk-old');
  });

  test('does not erase the only copy there is', async () => {
    const h = ports({ available: false, legacy: { 'openai-compatible': 'sk-old' } });
    await new SecretStore(h.p, ACCOUNTS).load();
    assert.equal(h.wasCleared(), false);
  });

  test('reports the keys that still have to be written to disk', async () => {
    const h = ports({ available: false });
    const s = new SecretStore(h.p, ACCOUNTS);
    await s.load();
    await s.set('openai-compatible', 'sk-new');
    assert.deepEqual(s.plaintext(), { 'openai-compatible': 'sk-new' });
  });

  test('never calls the keychain', async () => {
    let touched = false;
    const h = ports({ available: false });
    const watched: SecretPorts = {
      ...h.p,
      get: async a => { touched = true; return h.p.get(a); },
      set: async (a, v) => { touched = true; return h.p.set(a, v); },
    };
    const s = new SecretStore(watched, ACCOUNTS);
    await s.load();
    await s.set('openai-compatible', 'sk-new');
    assert.equal(touched, false);
  });
});

describe('an unknown account', () => {
  test('reads as empty', async () => {
    const s = new SecretStore(ports().p, ACCOUNTS);
    await s.load();
    assert.equal(s.get('nope'), '');
  });
});
