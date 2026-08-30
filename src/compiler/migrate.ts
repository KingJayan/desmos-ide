// rewrites a file written in the older grammar into the one statement shape

const LEGACY_MARKS = [
  /(^|\s)alias\s+[A-Za-z_]\w*\s*=/,
  /^\s*point\s+[A-Za-z_]\w*\s*\(/m,
  /^\s*curve\s+[A-Za-z_]\w*\s*\(/m,
  /^\s*circle\s+[A-Za-z_]\w*\s*\{/m,
  /=\s*circle\s*\(\s*\(/,
  /=\s*slope\s*\(/,
  /=\s*azimuth\s*\(/,
  /^\s*segment\s+[A-Za-z_]\w*\s*=(?![^]*segment\s*\()/m,
  /^\s*polygon\s+[A-Za-z_]\w*\s*=\s*\[/m,
  /^\s*line\s+[A-Za-z_]\w*\s*=(?!\s*line\s*\()[^=\n]+=(?!=)/m,
  /\s+at\s+\(/,
  /^\s*group\s+[A-Za-z_]\w*\s+as\s+"/m,
  /^\s*time\s+[A-Za-z_]\w*(?!\s*=\s*time\s*\()(\s|$)/m,
  /\s+domain\s+/,
  /\s+where\s+.+\s+else\s+/,
  /^\s*[A-Za-z_]\w*\s*=\s*(?![\s[]).+\s+for\s+[A-Za-z_]\w*\s+in\s+/m,
  /\[[^\]]*\.\.\.[^\]]*\]/,
  /^\s*expr\s*\{/m,
  /\sas\s+gradient\s*\(/,
  /\sas\s*\{[^:}]*\}/,
  /\speriod\s+/,
  /,\s*loop\s*\)/,
];

export function needsMigration(src: string): boolean {
  return LEGACY_MARKS.some(re => re.test(src));
}

/** ignore comments */
function splitComment(line: string): [string, string] {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inString = !inString;
    else if (!inString && line[i] === '/' && line[i + 1] === '/') {
      return [line.slice(0, i).trimEnd(), line.slice(i)];
    }
  }
  return [line, ''];
}

/** the text from `open` to its matching close, and where the close sits */
function matched(text: string, from: number): { inner: string; end: number } | null {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const close = pairs[text[from]];
  if (!close) return null;
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === text[from]) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return { inner: text.slice(from + 1, i), end: i };
    }
  }
  return null;
}

/** splits on commas that sit at the top level of the text */
function topSplit(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; }
  }
  out.push(text.slice(start).trim());
  return out.filter(p => p.length > 0);
}

const STYLE_NUMBERS = new Set(['opacity', 'pointSize', 'lineWidth', 'lineOpacity']);

/** `as { color red opacity 0.3 fill }` becomes a record */
function migrateStyle(code: string): string {
  const grad = code.match(/\sas\s+gradient\s*\(/);
  if (grad) {
    const open = code.indexOf('(', grad.index!);
    const span = matched(code, open);
    if (span) return `${code.slice(0, grad.index)} as { gradient: gradient(${span.inner}) }${code.slice(span.end + 1)}`;
  }

  const block = code.match(/\sas\s*\{/);
  if (!block) return code;
  const open = code.indexOf('{', block.index!);
  const span = matched(code, open);
  if (!span || span.inner.includes(':')) return code;

  const words = span.inner.trim().split(/\s+/).filter(Boolean);
  const props: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const key = words[i];
    if (key === 'fill') { props.push('fill: true'); continue; }
    if (key === 'gradient') {
      const rest = span.inner.slice(span.inner.indexOf('gradient'));
      const gopen = rest.indexOf('(');
      const gspan = matched(rest, gopen);
      if (!gspan) return code;
      props.push(`gradient: gradient(${gspan.inner})`);
      i += gspan.inner.split(/\s+/).length;
      continue;
    }
    if (STYLE_NUMBERS.has(key) || key === 'color') {
      props.push(`${key}: ${words[++i] ?? ''}`);
      continue;
    }
    return code;
  }
  return `${code.slice(0, block.index)} as { ${props.join(', ')} }${code.slice(span.end + 1)}`;
}

/** `[a, s ... b]` becomes `[a..b step s]` */
function migrateStepList(code: string): string {
  let out = code;
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== '[') continue;
    const span = matched(out, i);
    if (!span || !span.inner.includes('...')) continue;
    const [head, tail] = span.inner.split('...');
    const parts = topSplit(head);
    const end = tail.trim();
    const replaced = parts.length === 2
      ? `[${parts[0]}..${end} step ${parts[1]}]`
      : `[${parts[0]}..${end}]`;
    out = out.slice(0, i) + replaced + out.slice(span.end + 1);
  }
  return out;
}

function migrateCall(code: string, fn: string, keys: string[]): string {
  const at = code.indexOf(`${fn}(`);
  if (at === -1) return code;
  const span = matched(code, at + fn.length);
  if (!span) return code;
  const args = topSplit(span.inner);
  if (args.length > keys.length || args.some(a => a.includes('='))) return code;
  const named = args.map((a, i) => `${keys[i]}=${a}`).join(', ');
  return `${code.slice(0, at)}${fn}(${named})${code.slice(span.end + 1)}`;
}

/** `= slope(m), intercept(b)` and `= azimuth(a), elevation(e)` become one call */
function migrateChain(code: string, first: string, second: string, ctor: string): string {
  const re = new RegExp(`=\\s*${first}\\s*\\(`);
  const m = code.match(re);
  if (!m) return code;
  const open = code.indexOf('(', m.index!);
  const a = matched(code, open);
  if (!a) return code;

  const rest = code.slice(a.end + 1);
  const follows = rest.match(new RegExp(`^\\s*,\\s*${second}\\s*\\(`));
  if (!follows) return `${code.slice(0, m.index)}= ${ctor}(${first}=${a.inner})${rest}`;

  const bOpen = a.end + 1 + rest.indexOf('(');
  const b = matched(code, bOpen);
  if (!b) return code;
  return `${code.slice(0, m.index)}= ${ctor}(${first}=${a.inner}, ${second}=${b.inner})${code.slice(b.end + 1)}`;
}

function migrateStatement(code: string, blockName: () => string): string {
  let out = code;
  const indent = /^\s*/.exec(out)?.[0] ?? '';
  const body = out.slice(indent.length);

  if (/^alias\s/.test(body)) return indent + body.replace(/^alias\s+/, '');

  if (/^expr\s*\{/.test(body)) return `${indent}${blockName()} = ${body}`;

  const point = body.match(/^point\s+([A-Za-z_]\w*)\s*\(/);
  if (point) return `${indent}point ${point[1]} = ${body.slice(point[0].length - 1)}`;

  const circleBlock = body.match(/^circle\s+([A-Za-z_]\w*)\s*\{/);
  if (circleBlock) {
    const span = matched(body, body.indexOf('{'));
    if (span) {
      const center = span.inner.match(/center\s*(\([^)]*\))/);
      const radius = span.inner.match(/radius\s+(.+?)(?:\s*$)/);
      if (center && radius) {
        return `${indent}circle ${circleBlock[1]} = circle(center=${center[1]}, radius=${radius[1].trim()})${body.slice(span.end + 1)}`;
      }
    }
  }

  const curve = body.match(/^curve\s+([A-Za-z_]\w*)\s*\(/);
  if (curve) {
    const head = matched(body, body.indexOf('('));
    if (head) {
      const range = head.inner.match(/^\s*([A-Za-z_]\w*)\s+in\s+(.+)$/);
      const rest = body.slice(head.end + 1);
      const bodyOpen = rest.indexOf('{');
      const span = bodyOpen === -1 ? null : matched(rest, bodyOpen);
      if (range && span) {
        return `${indent}curve ${curve[1]} = curve(${range[1]} -> ${span.inner.trim()}, ${range[2].trim()})${rest.slice(span.end + 1)}`;
      }
    }
  }

  const segment = body.match(/^segment\s+([A-Za-z_]\w*)\s*=\s*(.+?)\s*->\s*(.+)$/);
  if (segment) return `${indent}segment ${segment[1]} = segment(${segment[2]}, ${segment[3]})`;

  const polygon = body.match(/^polygon\s+([A-Za-z_]\w*)\s*=\s*(\[.*\])(.*)$/);
  if (polygon) return `${indent}polygon ${polygon[1]} = polygon(${polygon[2]})${polygon[3]}`;

  const text = body.match(/^text\s+([A-Za-z_]\w*)\s*=\s*("(?:[^"]*)")\s+at\s+(\([^)]*\))(.*)$/);
  if (text) return `${indent}text ${text[1]} = text(${text[2]}, at=${text[3]})${text[4]}`;

  const group = body.match(/^group\s+([A-Za-z_]\w*)\s+as\s+("(?:[^"]*)")\s*$/);
  if (group) return `${indent}group ${group[1]} = group(${group[2]})`;

  const time = body.match(/^time\s+([A-Za-z_]\w*)\s*(?:=\s*(\S+\.\.\S+))?\s*(?:period\s+(\S+))?\s*(loop|mirror)?\s*$/);
  if (time && !/=\s*time\s*\(/.test(body)) {
    const args = [time[2] ?? '0..1'];
    if (time[3]) args.push(`period=${time[3]}`);
    if (time[4]) args.push(`mode=${time[4]}`);
    return `${indent}time ${time[1]} = time(${args.join(', ')})`;
  }

  out = indent + body;
  out = out.replace(/,\s*loop\s*\)/g, ', loop=true)');
  out = migrateChain(out, 'slope', 'intercept', 'line');
  out = migrateChain(out, 'azimuth', 'elevation', 'camera');
  if (/=\s*circle\s*\(\s*\(/.test(out)) out = migrateCall(out, 'circle', ['center', 'radius']);

  const standard = out.match(/^(\s*line\s+[A-Za-z_]\w*\s*=\s*[^=]+?)\s*=\s*([^=].*)$/);
  if (standard && !/=\s*line\s*\(/.test(out)) out = `${standard[1]} == ${standard[2]}`;

  const cond = out.match(/^(.*?)\s+where\s+(.+?)\s+else\s+(.+)$/);
  if (cond) {
    const lead = cond[1].match(/^(\s*(?:[A-Za-z_]\w*\s+)?[A-Za-z_]\w*\s*=\s*)(.*)$/);
    if (lead) out = `${lead[1]}if ${cond[2]} then ${lead[2]} else ${cond[3]}`;
  }

  out = out.replace(/\s+domain\s+/, ' where ');

  const comp = out.match(/^(\s*(?:[A-Za-z_]\w*\s+)?[A-Za-z_]\w*\s*=\s*)(.+?)\s+for\s+([A-Za-z_]\w*)\s+in\s+(.+)$/);
  if (comp && !comp[2].trimStart().startsWith('[')) {
    out = `${comp[1]}[${comp[2]} for ${comp[3]} in ${comp[4]}]`;
  }

  return migrateStepList(out);
}

/** joins a statement whose brackets stay open across lines, so one rewrite sees it whole */
function joinStatements(lines: string[]): string[] {
  const out: string[] = [];
  let held: string | null = null;
  let depth = 0;

  for (const line of lines) {
    const [code] = splitComment(line);
    const opens = (code.match(/[([{]/g) ?? []).length;
    const closes = (code.match(/[)\]}]/g) ?? []).length;

    if (held === null) {
      if (opens > closes) { held = line; depth = opens - closes; continue; }
      out.push(line);
      continue;
    }

    held += ` ${line.trim()}`;
    depth += opens - closes;
    if (depth <= 0) { out.push(held); held = null; }
  }

  if (held !== null) out.push(held);
  return out;
}

export function migrateDsl(src: string): string {
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  let blocks = 0;
  const blockName = () => `block${++blocks}`;

  const lines = joinStatements(src.replace(/\r\n?/g, '\n').split('\n')).map(line => {
    const [code, comment] = splitComment(line);
    if (code.trim() === '') return line;
    const rewritten = migrateStatement(migrateStyle(code), blockName);
    return comment ? `${rewritten}  ${comment}` : rewritten;
  });

  return lines.join(eol);
}
