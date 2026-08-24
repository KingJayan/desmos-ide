/// <reference types="node" />
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'dsmx-paths-home-'));
process.env.DSMX_HOME = home;

const box = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsmx-paths-')));
const project = join(box, 'project');
const outside = join(box, 'outside');
mkdirSync(project);
mkdirSync(outside);
writeFileSync(join(project, 'graph.dsmx'), 'x = 1\n');
writeFileSync(join(project, 'other.dsmx'), 'x = 2\n');
writeFileSync(join(outside, 'id_rsa'), 'secret\n');
symlinkSync(outside, join(project, 'escape'));

const { allowFile, allowRoot, allowed, allowedRoot, compareKey, flushAllowed, stripLongPrefix } =
  await import('../../bun/paths');

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

describe('windows path comparison', () => {
  test('the same folder in a different case is the same folder', () => {
    assert.equal(compareKey('C:\\Users\\x', true), compareKey('c:\\users\\X', true));
    assert.notEqual(compareKey('C:\\Users\\x', false), compareKey('c:\\users\\X', false));
  });

  test('a long path keeps the same identity with or without the \\\\?\\ prefix', () => {
    const long = `C:\\Users\\x\\${'d'.repeat(300)}\\graph.dsmx`;
    assert.ok(long.length > 260);
    assert.equal(stripLongPrefix(`\\\\?\\${long}`), long);
    assert.equal(compareKey(`\\\\?\\${long}`, true), compareKey(long, true));
  });

  test('a unc path keeps its two leading slashes', () => {
    assert.equal(stripLongPrefix('\\\\?\\UNC\\server\\share\\g.dsmx'), '\\\\server\\share\\g.dsmx');
    assert.equal(
      compareKey('\\\\?\\UNC\\Server\\Share\\g.dsmx', true),
      compareKey('\\\\server\\share\\g.dsmx', true),
    );
  });

  test('a path that is not a long path is left alone', () => {
    assert.equal(stripLongPrefix('/home/x/graph.dsmx'), '/home/x/graph.dsmx');
    assert.equal(stripLongPrefix('C:\\Users\\x'), 'C:\\Users\\x');
  });
});

describe('save as', () => {
  test('a file that does not exist yet is granted, and the grant is that file only', () => {
    const fresh = join(project, 'saved-as.dsmx');
    assert.equal(allowFile(fresh), fresh);
    assert.equal(allowed(fresh), fresh);
  });
});
