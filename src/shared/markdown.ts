import { escapeHtml } from './escape';

export type ResolveImage = (src: string) => string | null;

export interface MarkdownClasses {
  heading?: string;
  list?: string;
  listItem?: string;
  rule?: string;
  inlineCode?: string;
}

export interface MarkdownOptions {
  resolveImage?: ResolveImage;
  classes?: MarkdownClasses;
}

const NONE: MarkdownClasses = {};

function attr(name: string | undefined): string {
  return name ? ` class="${name}"` : '';
}

function safeUrl(href: string): string | null {
  return /^https:\/\//.test(href) ? href : null;
}

function inline(text: string, opts: MarkdownOptions): string {
  const classes = opts.classes ?? NONE;
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, `<code${attr(classes.inlineCode)}>$1</code>`)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
      const url = safeUrl(src) ?? opts.resolveImage?.(src) ?? null;
      return url ? `<img src="${url}" alt="${alt}" loading="lazy" />` : alt;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, href: string) => {
      const url = safeUrl(href);
      return url ? `<a href="${url}" target="_blank" rel="noreferrer noopener">${label}</a>` : m;
    });
}

export function markdownToHtml(src: string, opts: MarkdownOptions = {}): string {
  const classes = opts.classes ?? NONE;
  const out: string[] = [];
  const lines = src.split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] | null = null;
  let fence: string[] | null = null;

  const closeList = () => {
    if (!list) return;
    const tag = list.ordered ? 'ol' : 'ul';
    const items = list.items.map(li => `<li${attr(classes.listItem)}>${inline(li, opts)}</li>`).join('');
    out.push(`<${tag}${attr(classes.list)}>${items}</${tag}>`);
    list = null;
  };
  const closeQuote = () => {
    if (!quote) return;
    out.push(`<blockquote>${quote.map(q => `<p>${inline(q, opts)}</p>`).join('')}</blockquote>`);
    quote = null;
  };
  const closeBlocks = () => { closeList(); closeQuote(); };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (fence) { out.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`); fence = null; }
      else { closeBlocks(); fence = []; }
      continue;
    }
    if (fence) { fence.push(line); continue; }

    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { closeBlocks(); out.push(`<hr${attr(classes.rule)} />`); continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeBlocks();
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}${attr(classes.heading)}>${inline(heading[2], opts)}</h${level}>`);
      continue;
    }

    const quoted = /^\s*>\s?(.*)$/.exec(line);
    if (quoted) { closeList(); (quote ??= []).push(quoted[1]); continue; }
    closeQuote();

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (list?.ordered) closeList();
      (list ??= { ordered: false, items: [] }).items.push(bullet[1]);
      continue;
    }
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (list && !list.ordered) closeList();
      (list ??= { ordered: true, items: [] }).items.push(numbered[1]);
      continue;
    }

    if (line.trim() === '') { closeBlocks(); continue; }
    closeBlocks();
    out.push(`<p>${inline(line, opts)}</p>`);
  }

  closeBlocks();
  if (fence) out.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  return out.join('');
}

