// finds every place a name is used

import { CONSTRUCTOR_NAMES } from './builtins';
import { KEYWORDS, normalizeIdent, tokenize } from './lexer';

export interface RenameEdit {
  line: number;
  col: number;
  length: number;
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CONSTRUCTORS = new Set(CONSTRUCTOR_NAMES);

/** a rename that produced this name would not lex back to one identifier */
export function isValidIdent(name: string): boolean {
  const normal = normalizeIdent(name);
  return IDENT_RE.test(normal) && !KEYWORDS.has(normal) && !CONSTRUCTORS.has(normal);
}

export function findRenameEdits(src: string, target: string): RenameEdit[] {
  const name = normalizeIdent(target);
  let tokens;
  try {
    tokens = tokenize(src);
  } catch {
    return [];
  }

  const edits: RenameEdit[] = [];
  for (const tok of tokens) {
    if (tok.type !== 'ident' || tok.value !== name) continue;
    edits.push({ line: tok.line, col: tok.col, length: (tok.raw ?? tok.value).length });
  }
  return edits;
}
