import { markdownToHtml, type MarkdownClasses, type MarkdownOptions } from '../src/shared/markdown';

export { markdownToHtml };
export type { MarkdownClasses, MarkdownOptions, ResolveImage } from '../src/shared/markdown';

export function renderMarkdown(src: string, opts: MarkdownOptions = {}): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = markdownToHtml(src, opts);
  return el;
}

export const AI_MARKDOWN_CLASSES: MarkdownClasses = {
  heading: 'ai-heading',
  list: 'ai-list',
  listItem: 'ai-list-item',
  rule: 'ai-hr',
  inlineCode: 'ai-inline-code',
};
