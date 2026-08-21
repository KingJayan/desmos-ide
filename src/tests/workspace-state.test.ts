/// <reference types="node" />
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g['localStorage'] = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

const { WorkspaceState, baseNameOf, folderOf } = await import('../../renderer/workspace-state');

type Session = { path: string | null; source: string; mode: string; line: number; col: number };

function fresh(saw: Session[] = []): InstanceType<typeof WorkspaceState> {
  return new WorkspaceState({ recents: [], persist: state => { saw.push(state as Session); } });
}

describe('what the workspace knows', () => {
  beforeEach(() => store.clear());

  test('a path splits into a name and a folder', () => {
    assert.equal(baseNameOf('/a/b/graph.dsmx'), 'graph.dsmx');
    assert.equal(folderOf('/a/b/graph.dsmx'), '/a/b');
    assert.equal(baseNameOf(null), null);
    assert.equal(folderOf(null), null);
  });

  test('an unnamed buffer still has a name to show', () => {
    assert.equal(fresh().name(), 'untitled.dsmx');
  });

  test('only a move to another folder is reported as a move', () => {
    const w = fresh();
    assert.equal(w.setPath('/a/b/one.dsmx'), true);
    assert.equal(w.setPath('/a/b/two.dsmx'), false);
    assert.equal(w.setPath('/a/c/two.dsmx'), true);
    assert.equal(w.setPath(null), true);
  });

  test('a buffer with no file is always unsaved', () => {
    const w = fresh();
    assert.equal(w.isUnsaved('x = 1'), true);
    w.markSaved('x = 1');
    assert.equal(w.isUnsaved('x = 1'), false);
    assert.equal(w.isUnsaved('x = 2'), true);
    w.forgetSaved();
    assert.equal(w.isUnsaved('x = 1'), true);
  });

  test('opening a file puts it first in the recents, without repeats', () => {
    const seen: string[][] = [];
    const w = new WorkspaceState({ recents: [], onRecents: list => seen.push(list.map(f => f.path)) });
    w.setPath('/a/one.dsmx');
    w.setPath('/a/two.dsmx');
    w.setPath('/a/one.dsmx');
    assert.deepEqual(w.recents.map(f => f.path), ['/a/one.dsmx', '/a/two.dsmx']);
    assert.equal(seen.length, 3);
  });

  test('a file that cannot be reopened is dropped from the recents', () => {
    const w = fresh();
    w.setPath('/a/one.dsmx');
    w.forget('/a/one.dsmx');
    assert.deepEqual(w.recents, []);
  });

  test('watching one file at a time reports the one to drop', () => {
    const w = fresh();
    assert.equal(w.watch('/a/one.dsmx'), null);
    assert.equal(w.watch('/a/one.dsmx'), null);
    assert.equal(w.watch('/a/two.dsmx'), '/a/one.dsmx');
    assert.equal(w.unwatch(), '/a/two.dsmx');
    assert.equal(w.unwatch(), null);
  });

  test('the saved session carries the path, the mode and the cursor', () => {
    const saw: Session[] = [];
    const w = fresh(saw);
    w.setPath('/a/one.dsmx');
    w.setMode('split');
    w.persist('x = 1', 4, 2);
    assert.deepEqual(saw, [{ path: '/a/one.dsmx', source: 'x = 1', mode: 'split', line: 4, col: 2 }]);
  });
});
