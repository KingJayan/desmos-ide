/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CHATS, PRUNE_THRESHOLD,
  capChats, matchSlashCommands, pruneHistory, trimChatBytes, withContext,
} from '../../renderer/chat-store';
import type { Chat, ConvMessage } from '../../renderer/chat-store';

function chat(id: string): Chat {
  return { id, title: id, history: [] };
}

function turns(n: number): ConvMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `turn ${i}`,
  }));
}

describe('capping the chat list', () => {
  test('leaves a list that already fits', () => {
    const chats = [chat('a'), chat('b')];
    const out = capChats(chats, chats[1]);
    assert.equal(out.chats, chats);
    assert.equal(out.active, chats[1]);
  });

  test('keeps the newest and drops the oldest', () => {
    const chats = Array.from({ length: MAX_CHATS + 3 }, (_, i) => chat(String(i)));
    const out = capChats(chats, chats[chats.length - 1]);
    assert.equal(out.chats.length, MAX_CHATS);
    assert.equal(out.chats[0].id, '3');
  });

  test('moves the active chat when the old one was dropped', () => {
    const chats = Array.from({ length: MAX_CHATS + 1 }, (_, i) => chat(String(i)));
    const out = capChats(chats, chats[0]);
    assert.equal(out.active, out.chats[0]);
    assert.equal(out.active.id, '1');
  });

  test('keeps the active chat when it survived', () => {
    const chats = Array.from({ length: MAX_CHATS + 1 }, (_, i) => chat(String(i)));
    const out = capChats(chats, chats[5]);
    assert.equal(out.active.id, '5');
  });
});

describe('trimming a chat to its byte budget', () => {
  test('leaves a short chat alone', () => {
    const h = turns(4);
    assert.deepEqual(trimChatBytes(h, 10_000), h);
  });

  test('drops the oldest turns until it fits', () => {
    const h = turns(20);
    const out = trimChatBytes(h, 200);
    assert.ok(out.length < h.length);
    assert.ok(JSON.stringify(out).length <= 200 || out.length === 2);
    // what is kept is the tail, so the newest turns stay
    assert.equal(out[out.length - 1].content, 'turn 19');
  });

  test('always leaves two turns, even under an impossible budget', () => {
    assert.equal(trimChatBytes(turns(20), 1).length, 2);
  });

  test('does not change the array it was given', () => {
    const h = turns(20);
    trimChatBytes(h, 200);
    assert.equal(h.length, 20);
  });
});

describe('pruning the history', () => {
  test('says nothing when the chat is short', () => {
    const h = turns(PRUNE_THRESHOLD - 1);
    const out = pruneHistory(h);
    assert.equal(out.pruned, false);
    assert.equal(out.history, h);
  });

  test('cuts back to the newest turns at the threshold', () => {
    const out = pruneHistory(turns(PRUNE_THRESHOLD));
    assert.equal(out.pruned, true);
    assert.equal(out.history.length, PRUNE_THRESHOLD - 4);
    assert.equal(out.history[out.history.length - 1].content, `turn ${PRUNE_THRESHOLD - 1}`);
  });
});

describe('adding the editor context', () => {
  test('sends the prompt alone when there is nothing open', () => {
    assert.equal(withContext('hi', { dsl: '', selection: '' }), 'hi');
  });

  test('uses the whole file when nothing is selected', () => {
    const out = withContext('hi', { dsl: 'a = 1', selection: '' });
    assert.match(out, /Current file:/);
    assert.match(out, /```dsmx\na = 1\n```/);
  });

  test('a selection wins over the file', () => {
    const out = withContext('hi', { dsl: 'a = 1', selection: 'b = 2' });
    assert.match(out, /Selected code:/);
    assert.ok(out.includes('b = 2'));
    assert.ok(!out.includes('a = 1'));
  });

  test('cuts a long file and says that it did', () => {
    const out = withContext('hi', { dsl: 'x'.repeat(50), selection: '' }, 10);
    assert.ok(out.includes('…[truncated]'));
    assert.ok(out.includes('x'.repeat(10)));
    assert.ok(!out.includes('x'.repeat(11)));
  });

  test('leaves a file that is exactly at the limit whole', () => {
    const out = withContext('hi', { dsl: 'x'.repeat(10), selection: '' }, 10);
    assert.ok(!out.includes('…[truncated]'));
  });
});

describe('the slash command list', () => {
  test('offers nothing for ordinary text', () => {
    assert.deepEqual(matchSlashCommands('help'), []);
    assert.deepEqual(matchSlashCommands(''), []);
  });

  test('offers everything for a bare slash', () => {
    assert.equal(matchSlashCommands('/').length, 6);
  });

  test('narrows as the user types', () => {
    assert.deepEqual(matchSlashCommands('/mem').map(c => c.cmd), [
      '/memory add', '/memory list', '/memory clear',
    ]);
  });

  test('ignores a trailing space, so a finished command still matches', () => {
    assert.deepEqual(matchSlashCommands('/memory ').map(c => c.cmd), [
      '/memory add', '/memory list', '/memory clear',
    ]);
  });

  test('offers nothing for a command that is not there', () => {
    assert.deepEqual(matchSlashCommands('/nope'), []);
  });
});
