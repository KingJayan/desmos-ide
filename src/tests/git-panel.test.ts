/// <reference types="node" />
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

import type { GitStatusResult } from '../shared/rpc-schema';

const IDS = [
  'git-sidebar-container', 'git-branch', 'git-modified', 'git-summary-msg', 'git-refresh-status',
  'git-branch-panel-title', 'git-branch-empty', 'git-branch-list', 'git-branch-refresh',
  'git-branch-create', 'git-history-empty', 'git-history-content', 'git-history-refresh',
  'git-remote-panel-title', 'git-remote-empty', 'git-remote-list', 'git-remote-refresh',
  'git-remote-add', 'git-modified-panel-title', 'git-modified-empty', 'git-modified-list',
];

const { document, Element, Node } = parseHTML(
  `<html><body>${IDS.map(id => `<div id="${id}"></div>`).join('')}</body></html>`,
);

Object.assign(globalThis, { document, Element, Node });

const { GitPanel } = await import('../../renderer/git-panel');

type Api = Record<string, (...args: unknown[]) => Promise<unknown>>;

let calls: string[] = [];

function stubApi(over: Partial<Api> = {}): void {
  const count = (name: string, result: unknown) => async () => {
    calls.push(name);
    return result;
  };
  const status: GitStatusResult = {
    ok: true, branch: 'dev', modifiedCount: 2, modifiedFiles: ['a.dsmx', 'b.dsmx'],
  } as GitStatusResult;

  (globalThis as { window?: unknown }).window = {
    electronAPI: {
      gitStatus: count('status', status),
      gitBranches: count('branches', { ok: true, branches: [] }),
      gitHistory: count('history', { ok: true, lines: [] }),
      gitRemotes: count('remotes', { ok: true, remotes: [] }),
      ...over,
    },
  };
}

function panel(): InstanceType<typeof GitPanel> {
  return new GitPanel({ setStatus: () => {}, confirm: async () => true, prompt: async () => null });
}

const container = document.getElementById('git-sidebar-container')!;

describe('the git panel does not spawn a process per window focus', () => {
  beforeEach(() => {
    calls = [];
    container.classList.remove('hidden');
    stubApi();
  });

  test('a second focus a moment later asks git nothing', async () => {
    const p = panel();
    await p.refreshIfStale();
    const first = calls.length;
    assert.ok(first > 0);
    await p.refreshIfStale();
    assert.equal(calls.length, first);
  });

  test('an off-screen panel costs one call, not four', async () => {
    container.classList.add('hidden');
    await panel().refreshIfStale();
    assert.deepEqual(calls, ['status']);
  });

  test('the open panel is filled in full', async () => {
    await panel().refreshIfStale();
    assert.deepEqual(calls.sort(), ['branches', 'history', 'remotes', 'status']);
  });

  test('opening the panel fills it, however recent the last look', async () => {
    const p = panel();
    container.classList.add('hidden');
    await p.refreshIfStale();
    calls = [];

    container.classList.remove('hidden');
    await p.refreshIfStale();
    assert.deepEqual(calls.sort(), ['branches', 'history', 'remotes', 'status']);
  });

  test('a button press is never held back', async () => {
    const p = panel();
    await p.refreshAll();
    calls = [];
    await p.refreshAll();
    assert.equal(calls.length, 4);
  });
});

describe('the git panel renders what git reports', () => {
  beforeEach(() => {
    calls = [];
    container.classList.remove('hidden');
    stubApi();
  });

  test('the pills and the file list follow the status', async () => {
    await panel().refreshStatus();
    assert.equal(document.getElementById('git-branch')!.textContent, 'branch: dev');
    assert.equal(document.getElementById('git-modified')!.textContent, '2 modified');
    assert.equal(document.getElementById('git-modified-list')!.children.length, 2);
  });

  test('a failed call reaches the panel instead of the console', async () => {
    stubApi({ gitStatus: async () => { throw new Error('no git here'); } });
    await panel().refreshStatus();
    assert.match(document.getElementById('git-summary-msg')!.textContent ?? '', /no git here/);
    assert.equal(document.getElementById('git-branch')!.textContent, 'branch: --');
  });
});

describe('the git panel gives its timer back', () => {
  beforeEach(() => {
    calls = [];
    stubApi({ gitFetch: async () => { calls.push('fetch'); return { ok: false, errorCode: 'X', message: '' }; } });
    (globalThis as { document: { visibilityState: string } }).document.visibilityState = 'visible';
  });

  test('dispose stops the background fetch', async () => {
    const p = panel();
    p.applyAutofetch({ gitAutofetch: true, gitAutofetchPeriod: 0.01 });
    await new Promise(r => setTimeout(r, 40));
    assert.ok(calls.includes('fetch'));
    p.dispose();
    calls = [];
    await new Promise(r => setTimeout(r, 40));
    assert.deepEqual(calls, []);
  });
});
