import { escapeHtml } from './escape';

export type Part = { type: 'text'; content: string } | { type: 'code'; content: string; lang: string };

export function parseResponse(text: string): Part[] {
  const parts: Part[] = [];
  const re = /```(\w+)?\n?([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim();
    if (before) parts.push({ type: 'text', content: before });
    parts.push({ type: 'code', content: m[2].trim(), lang: m[1] || 'dsmx' });
    last = m.index + m[0].length;
  }
  const after = text.slice(last).trim();
  if (after) parts.push({ type: 'text', content: after });
  return parts;
}

export function formatInlineMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
  return html;
}

export function renderMarkdown(text: string): HTMLElement {
  const el = document.createElement('div');
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (/^---+$/.test(trimmed)) {
      const hr = document.createElement('div');
      hr.className = 'ai-hr';
      el.appendChild(hr);
      i++;
      continue;
    }

    const headingMatch = trimmed.match(/^##\s+(.+)$/);
    if (headingMatch) {
      const h = document.createElement('h3');
      h.className = 'ai-heading';
      h.textContent = headingMatch[1];
      el.appendChild(h);
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const list = /^[-*]\s+/.test(trimmed)
        ? document.createElement('ul')
        : document.createElement('ol');
      list.className = 'ai-list';
      while (i < lines.length) {
        const l = lines[i].trim();
        if (!l) break;
        const isBullet = /^[-*]\s+(.+)$/.test(l);
        const isNum = /^\d+\.\s+(.+)$/.test(l);
        if (!isBullet && !isNum) break;
        const content = l.replace(/^(?:[-*]|\d+\.)\s+/, '');
        const li = document.createElement('li');
        li.className = 'ai-list-item';
        li.innerHTML = formatInlineMarkdown(content);
        list.appendChild(li);
        i++;
      }
      el.appendChild(list);
      continue;
    }

    const p = document.createElement('p');
    p.innerHTML = formatInlineMarkdown(trimmed);
    el.appendChild(p);
    i++;
  }

  return el;
}

export function cleanTitle(raw: string): string {
  const words = raw.replace(/["'`]|[.\s]+$/g, '').replace(/\s+/g, ' ').trim().split(' ');
  return words.length > 6 ? words.slice(0, 6).join(' ') : words.join(' ');
}

export function truncateAtWord(raw: string, max = 40): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${space > 12 ? cut.slice(0, space) : cut}…`;
}
