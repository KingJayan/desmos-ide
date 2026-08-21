/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../shared/escape';

describe('escaping for markup', () => {
  test('escapes the angle brackets and the ampersand', () => {
    assert.equal(escapeHtml('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;');
  });

  test('escapes both quote characters, which attributes need', () => {
    assert.equal(escapeHtml(`"x" 'y'`), '&quot;x&quot; &#39;y&#39;');
  });

  test('a model id cannot break out of an attribute', () => {
    // the shape a hostile provider response would take
    const evil = '" onfocus="alert(1)" autofocus x="';
    const html = `<option value="${escapeHtml(evil)}">m</option>`;
    assert.ok(!html.includes('onfocus="'), html);
    // only the two quotes this template wrote are left
    assert.equal(html.match(/"/g)!.length, 2);
  });

  test('escapes the ampersand first, so nothing is escaped twice', () => {
    assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  });

  test('leaves ordinary text alone', () => {
    assert.equal(escapeHtml('gpt-4o-mini'), 'gpt-4o-mini');
  });
});
