// syntax highlighting for the snippets on this page

import { LANGUAGE_ID, languageConfig, monarchTokens } from '../../src/monaco/language';
import { monacoTheme } from '../../renderer/themes';

const CACHE_KEY = 'docs-snippets-v1';

let started = false;

function whenIdle(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
}

function apply(code, html) {
  code.innerHTML = html;
  code.parentElement.classList.add('highlighted');
}

// repaints from the previous visit
function applyCached(blocks) {
  let cache = null;
  try {
    cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    return false;
  }
  if (!cache) return false;
  if (!blocks.every(code => typeof cache[code.textContent] === 'string')) return false;
  for (const code of blocks) apply(code, cache[code.textContent]);
  return true;
}

async function colorizeAll(blocks) {
  const monaco = await import('monaco-editor/editor/editor.api');

  monaco.languages.register({ id: LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, languageConfig);
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, monarchTokens);
  const theme = monacoTheme('catppuccin-mocha');
  monaco.editor.defineTheme('desmos-docs', theme);
  monaco.editor.setTheme('desmos-docs');

  const cache = {};
  for (const code of blocks) {
    // textContent, not innerHTML
    const src = code.textContent;
    const html = await monaco.editor.colorize(src, LANGUAGE_ID, { tabSize: 2 });
    cache[src] = html;
    apply(code, html);
  }

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/** highlights every `pre > code` on the page except those marked `.no-highlight` */
export function highlightSnippets() {
  if (started) return;
  const blocks = Array.from(document.querySelectorAll('pre:not(.no-highlight) > code'));
  if (!blocks.length) return;

  started = true;
  if (applyCached(blocks)) return;

  whenIdle(() => {
    colorizeAll(blocks).catch(err => {
      console.warn('snippet highlighting unavailable', err);
    });
  });
}
