/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { platformOf, platformFromAgent, isPlatformInfo } = await import('../shared/platform');

describe('what the app runs on', () => {
  test('the main process answer is the one that counts', () => {
    assert.deepEqual(platformOf('darwin', 'arm64'), { os: 'macos', arch: 'arm64' });
    assert.deepEqual(platformOf('darwin', 'x64'), { os: 'macos', arch: 'x64' });
    assert.deepEqual(platformOf('linux', 'x64'), { os: 'linux', arch: 'x64' });
    assert.deepEqual(platformOf('win32', 'x64'), { os: 'win', arch: 'x64' });
  });

  test('an os nobody has heard of is treated as linux', () => {
    assert.equal(platformOf('freebsd', 'x64').os, 'linux');
  });

  test('the user agent carries the app until the answer arrives', () => {
    assert.equal(platformFromAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)').os, 'macos');
    assert.equal(platformFromAgent('Mozilla/5.0 (X11; Linux x86_64)').os, 'linux');
    assert.equal(platformFromAgent('Mozilla/5.0 (Windows NT 10.0; Win64)').os, 'win');
  });

  test('a stored answer is only used when it is one of ours', () => {
    assert.ok(isPlatformInfo({ os: 'linux', arch: 'x64' }));
    assert.ok(!isPlatformInfo({ os: 'plan9', arch: 'x64' }));
    assert.ok(!isPlatformInfo(null));
  });
});
