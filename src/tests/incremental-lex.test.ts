import { describe, it, expect } from 'bun:test';
import { tokenize } from '../compiler/lexer';
import { tokenizeIncremental, lexCacheOf } from '../compiler/incremental-lex';

const BASE = `// a demo file
a = slider(0, 0, 10)
fn f(x, y) = x^2 + y

point p (1, 2)
curve ring (t in 0..6.28) {
  (cos(t), sin(t))
}

polygon tri = [
  (0,0),
  (1,0),
  (0,1)
]
text lbl = "hello" at (1, 2)
z = { x > 0: x^2,
      x < 0: -x,
      else: 0 }
r = y > x^2 as { color blue opacity 0.3 }
`;

function expectSameAsFull(from: string, to: string): void {
  const { tokens } = tokenizeIncremental(to, lexCacheOf(from));
  expect(tokens).toEqual(tokenize(to));
}

describe('tokenizeIncremental', () => {
  it('matches a full lex when nothing changed', () => {
    expectSameAsFull(BASE, BASE);
  });

  it('matches a full lex with no cache', () => {
    const { tokens } = tokenizeIncremental(BASE, null);
    expect(tokens).toEqual(tokenize(BASE));
  });

  it('handles an edit inside one line', () => {
    expectSameAsFull(BASE, BASE.replace('x^2 + y', 'x^3 + 2y'));
  });

  it('handles an inserted line', () => {
    expectSameAsFull(BASE, BASE.replace('point p (1, 2)', 'point p (1, 2)\npoint q (3, 4)'));
  });

  it('handles a deleted line', () => {
    expectSameAsFull(BASE, BASE.replace('point p (1, 2)\n', ''));
  });

  it('handles an edit inside a multi-line block', () => {
    expectSameAsFull(BASE, BASE.replace('(cos(t), sin(t))', '(2cos(t), 3sin(t))\n  '));
  });

  it('handles an opened bracket that swallows the next statements', () => {
    expectSameAsFull(BASE, BASE.replace('polygon tri = [', 'polygon tri = [('));
  });

  it('handles a closed bracket that splits a statement in two', () => {
    expectSameAsFull(BASE, BASE.replace('z = { x > 0: x^2,', 'z = { x > 0: x^2 }\nw = 1,'));
  });

  it('handles an edit at the very start', () => {
    expectSameAsFull(BASE, `b = 7\n${BASE}`);
  });

  it('handles an edit at the very end, with no trailing newline', () => {
    expectSameAsFull(BASE, `${BASE}final = 9`);
  });

  it('handles a file with no trailing newline as the base', () => {
    expectSameAsFull('a = 1\nb = 2', 'a = 1\nb = 22');
  });

  it('handles emptying the file', () => {
    expectSameAsFull(BASE, '');
  });

  it('handles growing from an empty file', () => {
    expectSameAsFull('', BASE);
  });

  it('keeps greek normalisation and its raw text', () => {
    expectSameAsFull('α = 1\nb = 2', 'α = 1\nb = β');
  });

  it('survives a chain of edits from one cache', () => {
    let src = BASE;
    let cache = lexCacheOf(src);
    const edits: ((s: string) => string)[] = [
      s => s.replace('a = slider(0, 0, 10)', 'a = slider(1, 0, 20)'),
      s => `${s}extra = 1\n`,
      s => s.replace('point p (1, 2)\n', ''),
      s => s.replace('  (cos(t), sin(t))\n', ''),
      s => s.replace('text lbl', '// text lbl'),
      s => s.replace('polygon tri = [', 'polygon tri2 = ['),
      s => s.replace('\n\n', '\n'),
    ];
    for (const edit of edits) {
      src = edit(src);
      const step = tokenizeIncremental(src, cache);
      expect(step.tokens).toEqual(tokenize(src));
      cache = step.cache;
    }
  });

  it('matches a full lex over many random edits', () => {
    const alphabet = 'ab()[]{}=+,\n "0.';
    let seed = 12345;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };

    let src = BASE;
    let cache = lexCacheOf(src);
    for (let i = 0; i < 400; i++) {
      const at = rand(src.length + 1);
      const next = rand(3) === 0 && src.length > 0
        ? src.slice(0, at) + src.slice(at + 1)
        : src.slice(0, at) + alphabet[rand(alphabet.length)] + src.slice(at);

      let expected: ReturnType<typeof tokenize>;
      try {
        expected = tokenize(next);
      } catch {
        continue; // an unterminated string is a lex error either way
      }
      const step = tokenizeIncremental(next, cache);
      expect(step.tokens).toEqual(expected);
      src = next;
      cache = step.cache;
    }
  });
});
