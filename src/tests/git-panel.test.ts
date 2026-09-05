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
  `<html><body>${IDS.map(id => `<div id="${id}"></div>`).join('')}`
  + '<textarea id="git-commit-message"></textarea>'
  + '<button id="git-commit-btn"></button></body></html>',
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
    staged: ['a.dsmx'], unstaged: ['b.dsmx'],
  } as GitStatusResult;

  (globalThis as { window?: unknown }).window = {
    electronAPI: {
      gitStatus: count('status', status),
      gitBranches: count('branches', { ok: true, branches: [] }),
      gitHistory: count('history', { ok: true, commits: [] }),
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

  test('a failed call reaches the panel as a sentence, not a stack trace', async () => {
    stubApi({ gitStatus: async () => { throw new Error('no git here'); } });
    await panel().refreshStatus();
    const msg = document.getElementById('git-summary-msg')!.textContent ?? '';
    assert.match(msg, /try again/);
    assert.doesNotMatch(msg, /no git here|Error/);
    assert.equal(document.getElementById('git-branch')!.textContent, 'branch: --');
  });
});

describe('the git panel commits', () => {
  beforeEach(() => {
    calls = [];
    container.classList.remove('hidden');
    stubApi();
    (document.getElementById('git-commit-message') as HTMLTextAreaElement).value = '';
  });

  test('a staged file is marked and its toggle unstages it', async () => {
    let asked: string[] = [];
    stubApi({ gitUnstage: async (paths: unknown) => { asked = paths as string[]; return { ok: true, message: '' }; } });
    const p = panel();
    await p.refreshStatus();
    const rows = document.getElementById('git-modified-list')!.children;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].querySelector('.git-change-name')!.className, 'git-change-name git-change-name--staged');
    (rows[0].querySelector('.git-change-stage') as HTMLElement).dispatchEvent(new document.defaultView!.Event('click'));
    await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(asked, ['a.dsmx']);
  });

  test('commit stays out of reach until there is a message and something staged', async () => {
    const p = panel();
    await p.refreshStatus();
    const button = document.getElementById('git-commit-btn') as HTMLButtonElement;
    assert.equal(button.disabled, true);

    const box = document.getElementById('git-commit-message') as HTMLTextAreaElement;
    box.value = 'fix the rose';
    box.dispatchEvent(new document.defaultView!.Event('input'));
    assert.equal(button.disabled, false);
  });

  test('nothing staged means the button stays off however long the message', async () => {
    stubApi({
      gitStatus: async () => ({
        ok: true, branch: 'dev', modifiedCount: 1, modifiedFiles: ['a.dsmx'], staged: [], unstaged: ['a.dsmx'],
      }),
    });
    const p = panel();
    await p.refreshStatus();
    const box = document.getElementById('git-commit-message') as HTMLTextAreaElement;
    box.value = 'a message';
    box.dispatchEvent(new document.defaultView!.Event('input'));
    assert.equal((document.getElementById('git-commit-btn') as HTMLButtonElement).disabled, true);
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

describe('the git panel sections fold away', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    calls = [];
    store.clear();
    stubApi();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    };
    container.innerHTML = `
      <section class="git-section">
        <div class="git-section-header" data-section="branch" aria-expanded="true"></div>
        <ul class="git-modified-list"></ul>
      </section>`;
  });

  test('a click folds the section and a second one opens it', () => {
    panel();
    const header = container.querySelector('.git-section-header')!;
    const section = header.parentElement!;
    header.dispatchEvent(new document.defaultView!.Event('click'));
    assert.ok(section.classList.contains('git-section--collapsed'));
    assert.equal(header.getAttribute('aria-expanded'), 'false');
    header.dispatchEvent(new document.defaultView!.Event('click'));
    assert.ok(!section.classList.contains('git-section--collapsed'));
  });

  test('a folded section is still folded next time', () => {
    store.set('git-section-branch', 'collapsed');
    panel();
    assert.ok(container.querySelector('.git-section')!.classList.contains('git-section--collapsed'));
  });
});
