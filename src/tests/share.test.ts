/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { decodeShare, encodeShare, shareToken, shareUrl, MAX_SHARE_CHARS } from '../share';

const SAMPLE = 'a = slider(0, 0, 10)\ncurve ring (t in 0..6.28) { (cos(t), sin(t)) }\n';

describe('a share link carries the source', () => {
  test('a round trip returns the file byte for byte', async () => {
    assert.equal(await decodeShare(await encodeShare(SAMPLE)), SAMPLE);
  });

  test('non-ascii survives the trip', async () => {
    const src = 'α = 2\nβ = α * 3 // ångström\n';
    assert.equal(await decodeShare(await encodeShare(src)), src);
  });

  test('the token is url safe', async () => {
    assert.match(await encodeShare(SAMPLE), /^[12][A-Za-z0-9\-_]*$/);
  });

  test('the plain form decodes as well as the deflated one', async () => {
    const raw = '1' + Buffer.from(SAMPLE, 'utf8').toString('base64url');
    assert.equal(await decodeShare(raw), SAMPLE);
  });

  test('a damaged token is refused, not guessed at', async () => {
    assert.equal(await decodeShare(''), null);
    assert.equal(await decodeShare('2'), null);
    assert.equal(await decodeShare('9abc'), null);
    assert.equal(await decodeShare('2zzzz'), null);
  });
});

describe('the url form', () => {
  test('the fragment holds the token, so no server ever sees the source', async () => {
    const url = (await shareUrl(SAMPLE))!;
    assert.equal(url.includes('#c='), true);
    assert.equal(new URL(url).search, '');
    assert.equal(await decodeShare(shareToken(new URL(url).hash)!), SAMPLE);
  });

  test('a file too big for a link gives null instead of a broken url', async () => {
    let big = '';
    for (let i = 0; i < 20_000; i++) big += String.fromCharCode(33 + Math.floor(Math.random() * 90));
    assert.equal(await shareUrl(big), null);
  });

  test('an ordinary file is far inside the limit', async () => {
    assert.equal((await shareUrl(SAMPLE))!.length < MAX_SHARE_CHARS, true);
  });

  test('a hash with no token reads as none', () => {
    assert.equal(shareToken('#'), null);
    assert.equal(shareToken(''), null);
  });
});
