
export interface MacroSite {
  line: number;
  macro: string;
  args: (number | string)[];
}

export interface MacroError {
  line: number;
  col: number;
  message: string;
}

export interface Expanded {
  src: string;
  lineMap: number[];
}

const CALL = /^(\s*)@([a-zA-Z][a-zA-Z0-9_]*)\s*\((.*)\)\s*$/;

function splitArgs(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inString = !inString; current += ch; continue; }
    if (ch === ',' && !inString) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  if (current.trim() !== '' || parts.length > 0) parts.push(current);
  return parts;
}

function parseArg(text: string): number | string | null {
  const t = text.trim();
  if (t === '') return null;
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return t.slice(1, -1);
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(t)) return Number(t);
  return null;
}

export function findMacros(src: string): { sites: MacroSite[]; errors: MacroError[] } {
  const sites: MacroSite[] = [];
  const errors: MacroError[] = [];

  src.split('\n').forEach((text, i) => {
    const m = CALL.exec(text);
    if (!m) return;
    const [, indent, macro, argText] = m;
    const line = i + 1;

    const args: (number | string)[] = [];
    let bad = false;
    for (const piece of splitArgs(argText)) {
      const value = parseArg(piece);
      if (value === null) { bad = true; break; }
      args.push(value);
    }

    if (bad) {
      errors.push({
        line,
        col: indent.length + 1,
        message: `@${macro} takes numbers and quoted strings only`,
      });
      return;
    }
    sites.push({ line, macro, args });
  });

  return { sites, errors };
}

export function applyMacros(src: string, expansions: Map<number, string>): Expanded {
  const out: string[] = [];
  const lineMap: number[] = [];

  src.split('\n').forEach((text, i) => {
    const line = i + 1;
    const dsl = expansions.get(line);

    if (dsl === undefined) {
      if (CALL.test(text)) {
        out.push(`// ${text.trim()}`);
        lineMap.push(line);
        return;
      }
      out.push(text);
      lineMap.push(line);
      return;
    }

    const produced = dsl.split('\n');
    for (const produce of produced) {
      out.push(produce);
      lineMap.push(line);
    }
  });

  return { src: out.join('\n'), lineMap };
}

export function toSourceLine(lineMap: number[], compiledLine: number): number {
  return lineMap[compiledLine - 1] ?? compiledLine;
}
