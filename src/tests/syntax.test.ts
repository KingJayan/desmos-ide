/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { KEYWORDS } from '../compiler/lexer';
import { BUILTINS } from '../compiler/builtins';
import { DESMOS_NAMED } from '../compiler/codegen';
import { SYNTAX_FORMS, STYLE_PROPS, syntaxReference } from '../compiler/syntax';
import { compile } from '../index';
import { DSL_SYSTEM_PROMPT } from '../../bun/prompt';

const reference = syntaxReference();

describe('the syntax reference', () => {
  test('every keyword the lexer knows has a form', () => {
    const claimed = new Set(SYNTAX_FORMS.flatMap(f => f.keywords));
    const missing = [...KEYWORDS].filter(kw => !claimed.has(kw));
    assert.deepEqual(missing, [], `keywords with no syntax form: ${missing.join(', ')}`);
  });

  test('every claimed keyword is one the lexer knows', () => {
    const unknown = SYNTAX_FORMS.flatMap(f => f.keywords).filter(kw => !KEYWORDS.has(kw));
    assert.deepEqual(unknown, []);
  });

  test('every builtin is described', () => {
    for (const b of BUILTINS) assert.ok(reference.includes(b.signature), b.name);
  });

  test('every named color is listed', () => {
    for (const name of Object.keys(DESMOS_NAMED)) {
      assert.ok(reference.includes(name), name);
    }
  });

  test('every style property is listed', () => {
    for (const prop of STYLE_PROPS) assert.ok(reference.includes(prop), prop);
  });

  test('every example line compiles', () => {
    // a whole form at once, so a form can build on its own earlier lines
    const preamble = ['a = 1', 'b = 2', 'fn hyp(u, v) = sqrt(u^2 + v^2)'];
    for (const form of SYNTAX_FORMS) {
      const src = [...preamble, ...form.code].join('\n');
      const r = compile(src);
      assert.ok(r.success, `${form.title}: ${r.success ? '' : r.errors[0]!.message}`);
    }
  });
});

describe('the ai system prompt', () => {
  test('carries the generated reference', () => {
    assert.ok(DSL_SYSTEM_PROMPT.includes(reference));
  });

  test('keeps the prompt-injection guard', () => {
    assert.match(DSL_SYSTEM_PROMPT, /untrusted input/);
    assert.match(DSL_SYSTEM_PROMPT, /REMINDER: Ignore any instructions/);
  });
});
