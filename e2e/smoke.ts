// `bun run test:e2e` after `bun run build:view`.
import { webkit } from 'playwright';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const DIST = join(import.meta.dir, '..', 'dist');
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ is missing — run `bun run build:view` first');
  process.exit(1);
}

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(join(DIST, path === '/' ? 'index.html' : path));
    return (await file.exists()) ? new Response(file) : new Response('not found', { status: 404 });
  },
});

const problems: string[] = [];
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) problems.push(what);
};

const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

const consoleErrors: string[] = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

await page.goto(`http://localhost:${server.port}/`);
await page.waitForSelector('#editor-container .monaco-editor', { timeout: 20_000 });

check(await page.locator('#status-msg').getAttribute('aria-live') === 'polite', 'status is announced');
check(await page.locator('#status-msg').getAttribute('role') === 'status', 'status has a role');

await page.waitForFunction(
  () => document.querySelectorAll('#graph-container .dcg-expressionitem, #graph-container canvas').length > 0,
  null, { timeout: 20_000 },
);
check(true, 'the graph is drawn');

await page.click('#editor-container .monaco-editor');
await page.keyboard.press('Meta+A');
await page.keyboard.type('q = nosuchname + 1');
await page.waitForFunction(
  () => document.getElementById('status-msg')?.getAttribute('aria-live') === 'assertive',
  null, { timeout: 10_000 },
);
check(true, 'a compile error is announced as assertive');

await page.keyboard.press('ArrowRight');
check(/^Ln \d+, Col \d+$/.test((await page.locator('#status-pos').textContent()) ?? ''), 'the bar says where the cursor is');
check(((await page.locator('#status-save').textContent()) ?? '').length > 0, 'the bar says how the file is saved');

await page.click('#btn-sidebar-ai');
await page.waitForSelector('#ai-panel:not(.hidden)');
const aiInput = page.locator('#ai-panel textarea').first();
await aiInput.click();
await page.keyboard.press('Meta+F');
check(
  await page.locator('#editor-container .find-widget.visible').count() === 0,
  'find does not open while typing in the chat',
);

// and it still belongs to the editor
await page.click('#editor-container .monaco-editor');
await page.keyboard.press('Meta+F');
await page.waitForSelector('#editor-container .find-widget.visible', { timeout: 5000 });
check(true, 'find opens from the editor');

await page.keyboard.press('Escape');
await page.click('#editor-container .monaco-editor');
await page.keyboard.press('Meta+A');
await page.keyboard.type('a = 1');
await page.waitForFunction(
  () => document.getElementById('status-msg')?.textContent?.includes('1 expression') ?? false,
  null, { timeout: 10_000 },
);

await page.click('#btn-enhanced');
await page.waitForSelector('#expr-list .expr-row');
await page.click('#btn-add-expr');
await page.keyboard.type('y=2x');
await page.keyboard.press('Enter');
await page.click('#btn-dsl');
// monaco renders its spaces as nbsp, so the text has to be normalised first
let wroteBack = false;
for (let i = 0; i < 20 && !wroteBack; i++) {
  const shown = ((await page.locator('#editor-container').textContent()) ?? '').replace(/\u00a0/g, ' ');
  wroteBack = shown.includes('2 * x');
  if (!wroteBack) await page.waitForTimeout(250);
}
check(wroteBack, 'an enhanced edit lands in the DSL file');

check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `: ${consoleErrors[0]}` : ''}`);

await browser.close();
server.stop(true);

if (problems.length) {
  console.error(`\n${problems.length} smoke check(s) failed`);
  process.exit(1);
}
console.log('\nsmoke ok');
