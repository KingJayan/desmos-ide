/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deleteSecret, getSecret, secretsAvailable, setSecret } from '../../bun/secrets';

// the value below is a test string, never a real credential
const ACCOUNT = 'desmos-ide-test-account';
const VALUE = 'test-value-not-a-secret';

const mac = process.platform === 'darwin';

describe('the keychain', { skip: mac ? false : 'macOS only' }, () => {
  test('reports that it is there', () => {
    assert.equal(secretsAvailable(), true);
  });

  test('writes, reads and deletes', async () => {
    try {
      assert.equal(await setSecret(ACCOUNT, VALUE), true);
      assert.equal(await getSecret(ACCOUNT), VALUE);
      assert.equal(await deleteSecret(ACCOUNT), true);
      assert.equal(await getSecret(ACCOUNT), null);
    } finally {
      await deleteSecret(ACCOUNT);
    }
  });

  test('a second write replaces the first', async () => {
    try {
      await setSecret(ACCOUNT, VALUE);
      await setSecret(ACCOUNT, `${VALUE}-two`);
      assert.equal(await getSecret(ACCOUNT), `${VALUE}-two`);
    } finally {
      await deleteSecret(ACCOUNT);
    }
  });

  test('an empty value deletes rather than storing nothing', async () => {
    try {
      await setSecret(ACCOUNT, VALUE);
      await setSecret(ACCOUNT, '');
      assert.equal(await getSecret(ACCOUNT), null);
    } finally {
      await deleteSecret(ACCOUNT);
    }
  });

  test('a value with spaces and quotes survives the round trip', async () => {
    const awkward = 'a b "c" \'d\' $e `f`';
    try {
      await setSecret(ACCOUNT, awkward);
      assert.equal(await getSecret(ACCOUNT), awkward);
    } finally {
      await deleteSecret(ACCOUNT);
    }
  });

  test('reading something that is not there is null, not a throw', async () => {
    assert.equal(await getSecret('desmos-ide-no-such-account'), null);
  });

  test('deleting something that is not there still reports done', async () => {
    assert.equal(await deleteSecret('desmos-ide-no-such-account'), true);
  });

  test('an empty account is refused', async () => {
    assert.equal(await getSecret(''), null);
    assert.equal(await setSecret('', 'x'), false);
  });
});
