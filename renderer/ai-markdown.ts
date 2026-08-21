import { escapeHtml } from '../src/shared/escape';

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
