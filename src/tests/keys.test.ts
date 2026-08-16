/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const { document, Element } = parseHTML(`<html><body>
  <div id="editor-container"><textarea id="editor-input"></textarea></div>
  <div id="ai-panel"><div id="ai-sidebar"><textarea id="ai-input"></textarea><button id="ai-send"></button></div></div>
  <div id="search-panel"><input id="search-input" /></div>
  <div id="graph-container"><canvas id="graph"></canvas></div>
</body></html>`);

Object.assign(globalThis, { document, Element });

const { typingElsewhere } = await import('../../renderer/keys');

const at = (id: string): Element => document.getElementById(id)!;

describe('editor shortcuts stay with the editor', () => {
  test('the editor keeps them', () => {
    assert.equal(typingElsewhere(at('editor-input')), false);
    assert.equal(typingElsewhere(at('editor-container')), false);
  });

  test('the ai chat box keeps its own find', () => {
    assert.equal(typingElsewhere(at('ai-input')), true);
    assert.equal(typingElsewhere(at('ai-send')), true);
  });

  test('any other text box keeps them too', () => {
    assert.equal(typingElsewhere(at('search-input')), true);
  });

  test('the graph and an empty target hand them back to the editor', () => {
    assert.equal(typingElsewhere(at('graph')), false);
    assert.equal(typingElsewhere(null), false);
  });
});
