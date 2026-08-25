/// <reference types="node" />
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'dsmx-paths-home-'));
process.env.DSMX_HOME = home;

const box = realpathSync(mkdtempSync(join(tmpdir(), 'dsmx-paths-')));
const project = join(box, 'project');
const outside = join(box, 'outside');
mkdirSync(project);
mkdirSync(outside);
writeFileSync(join(project, 'graph.dsmx'), 'x = 1\n');
writeFileSync(join(project, 'other.dsmx'), 'x = 2\n');
writeFileSync(join(outside, 'id_rsa'), 'secret\n');
symlinkSync(outside, join(project, 'escape'));

const { allowFile, allowRoot, allowed, allowedRoot, flushAllowed } = await import('../../bun/paths');

after(async () => {
  await flushAllowed();
  rmSync(home, { recursive: true, force: true });
  rmSync(box, { recursive: true, force: true });
});

describe('the filesystem allow-list', () => {
  test('a symlink out of an allowed folder is refused', () => {
    assert.equal(allowRoot(project), project);
    assert.equal(allowed(join(project, 'other.dsmx')), join(project, 'other.dsmx'));
    assert.equal(allowed(join(project, 'escape', 'id_rsa')), null);
  });

  test('a symlink out of an allowed folder is refused as a search root too', () => {
    assert.equal(allowedRoot(join(project, 'escape')), null);
  });

  test('one picked file does not grant its folder', () => {
    const picked = join(outside, 'id_rsa');
    assert.equal(allowFile(picked), picked);
    assert.equal(allowed(picked), picked);
    assert.equal(allowed(join(outside, 'neighbour.dsmx')), null);
  });

  test('a path with a nul byte is refused', () => {
    assert.equal(allowed(`${project}/graph.dsmx\0.png`), null);
  });

  test('a file that does not exist yet resolves through its parents', () => {
    const link = join(project, 'escape', 'new.dsmx');
    assert.equal(allowed(link), null);
    assert.equal(allowed(join(project, 'new.dsmx')), join(project, 'new.dsmx'));
  });
});
