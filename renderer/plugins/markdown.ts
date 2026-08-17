import { escapeHtml } from '../escape';

// a readme comes off the network, so it is escaped first and only then given the few
// marks that make it readable. nothing here can produce a tag the author chose.

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (_m, label: string, href: string) =>
      `<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`);
}

export function renderMarkdown(src: string): string {
  const out: string[] = [];
  const lines = src.split('\n');
  let list: string[] = [];
  let fence: string[] | null = null;

  const closeList = () => {
    if (list.length === 0) return;
    out.push(`<ul>${list.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`);
    list = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (fence) { out.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`); fence = null; }
      else { closeList(); fence = []; }
      continue;
    }
    if (fence) { fence.push(line); continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item) { list.push(item[1]); continue; }

    if (line.trim() === '') { closeList(); continue; }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  if (fence) out.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  return out.join('');
}
