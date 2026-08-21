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

let stage = 'launching webkit';
const watchdog = setTimeout(() => {
  console.error(`\nsmoke gave up while ${stage}`);
  process.exit(1);
}, 5 * 60_000);

const browser = await webkit.launch();
stage = 'opening a page';
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

// there is no bun process behind a browser, so the plugin bridge is stubbed with one
// real plugin. everything past this point — the sandbox, the macro pass, the panel and
// the extension page — is the shipping code
await page.addInitScript(() => {
  const manifest = {
    id: 'starfield', name: 'Starfield', version: '1.0.0',
    description: 'scatters points in a spiral', author: 'desmos-ide',
    main: 'main.js', icon: '✦',
  };
  const plugin = {
    manifest,
    main: `dsmx.macro('stars', (n) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push('point star_' + i + ' (' + i + ', ' + i + ')');
      return out.join('\\n');
    });
    dsmx.command('insert', 'starfield: insert stars', () => ({ insert: '@stars(3)\\n' }));

    let count = dsmx.globalState.get('count', 3);

    dsmx.window.registerView({
      id: 'shaper',
      title: 'starfield',
      widgets: [
        { kind: 'slider', id: 'count', label: 'count', value: count, min: 1, max: 9, step: 1 },
        { kind: 'button', id: 'go', label: 'scatter', primary: true },
        { kind: 'iframe', src: 'https://example.dev' },
      ],
    }, (widget, value) => {
      if (widget === 'count') {
        count = value;
        dsmx.globalState.update('count', value);
        dsmx.window.updateView('shaper', [
          { kind: 'slider', id: 'count', label: 'count', value: count, min: 1, max: 9, step: 1 },
          { kind: 'button', id: 'go', label: 'scatter', primary: true },
        ]);
        return;
      }
      if (widget === 'go') {
        dsmx.editor.insert('@stars(' + count + ')\\n');
        dsmx.window.showInformationMessage('scattered ' + count + ' stars');
      }
    });

    const reachable = [];
    try {
      const global = globalThis;
      for (const name of ['fetch', 'XMLHttpRequest', 'importScripts', 'indexedDB', 'caches',
                          'navigator', 'location', 'createImageBitmap', 'addEventListener']) {
        for (let level = global; level; level = Object.getPrototypeOf(level)) {
          const held = Object.getOwnPropertyDescriptor(level, name);
          if (!held) continue;
          if (held.value === undefined && typeof held.get !== 'function') continue;
          reachable.push(name);
          break;
        }
      }
    } catch (err) {
      reachable.push('threw');
    }

    let builds = false;
    try { Function('return 1')(); builds = true; } catch (err) { builds = false; }
    try { (function () {}).constructor('return 1')(); builds = true; } catch (err) { }

    dsmx.window.registerStatusBarItem({
      id: 'sealed',
      text: reachable.length ? 'leaks ' + reachable.length : (builds ? 'builds code' : 'sealed'),
    });
    dsmx.window.registerStatusBarItem({ id: 'count', text: 'stars', command: 'insert' });
    dsmx.keybindings.register('Alt+K', 'insert');
    dsmx.menus.register('graph', 'insert', 'Insert stars');`,
    lib: 'fn twice(x) = 2*x\n',
    readme: '# Starfield\n\nPuts points in a spiral.\n',
    enabled: true,
  };
  const stub: Record<string, unknown> = {
    pluginList: () => Promise.resolve([plugin]),
    pluginRegistry: () => Promise.resolve({
      ok: true,
      index: { version: 1, plugins: [{ manifest, path: 'plugins/starfield' }, {
        manifest: { ...manifest, id: 'lissajous', name: 'Lissajous', description: 'draws figures' },
        path: 'plugins/lissajous',
      }] },
    }),
    pluginSetEnabled: () => Promise.resolve({ ok: true }),
    pluginUninstall: () => Promise.resolve({ ok: true }),
    pluginInstall: () => Promise.resolve({ ok: false, message: 'not in this test' }),
    pluginIcon: () => Promise.resolve(null),
    pluginReadme: () => Promise.resolve('# Lissajous\n\nDraws figures.\n'),
    pluginState: () => Promise.resolve({
      global: {}, workspace: {}, storagePath: null, globalStoragePath: null,
    }),
    pluginStateUpdate: () => Promise.resolve(true),
    pluginSecret: () => Promise.resolve(null),
    pluginSecretStore: () => Promise.resolve(true),
    pluginSecretDelete: () => Promise.resolve(true),
  };

  // anything the stub does not answer behaves the way a missing bridge does, so the
  // rest of the app is tested exactly as it was before
  (window as unknown as { electronAPI: unknown }).electronAPI = new Proxy(stub, {
    get: (target, prop: string) => (prop in target ? target[prop] : () => undefined),
  });
});

const consoleErrors: string[] = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

stage = 'loading the page';
await page.goto(`http://localhost:${server.port}/`);
stage = 'waiting for the editor';
await page.waitForSelector('#editor-container .monaco-editor', { timeout: 20_000 });
stage = 'checking the page';

// a first run opens the welcome dialog, and everything after this needs it gone
await page.waitForSelector('.welcome-overlay:not(.hidden)', { timeout: 10_000 });
check(await page.locator('.welcome-modal .welcome-mark').count() === 1, 'the welcome dialog wears the app mark');
await page.keyboard.press('Escape');
await page.waitForSelector('.welcome-overlay', { state: 'hidden' });
check(true, 'escape closes the welcome dialog');

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
check(
  await page.locator('#ai-del-btn svg').count() === 1 && await page.locator('#ai-new-btn svg').count() === 1,
  'every button in the chat header draws its icon',
);

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

await page.click('#editor-container .monaco-editor');
await page.keyboard.press('Meta+A');
await page.keyboard.type('a = 2*3 + 1');
await page.click('#btn-tool-optimizer');
await page.waitForSelector('#optimizer-body:not(.hidden) .optimizer-row', { timeout: 10_000 });
check(await page.locator('#optimizer-row, #optimizer-list .optimizer-row').count() >= 2, 'the optimizer lists both folds');
check(
  ((await page.locator('#optimizer-list').textContent()) ?? '').includes('7'),
  'the report shows the folded result',
);

let hint = '';
for (let i = 0; i < 20 && !hint; i++) {
  hint = (await page.locator('.optimizer-hint').first().textContent().catch(() => '')) ?? '';
  if (!hint) await page.waitForTimeout(250);
}
check(hint.includes('7'), `the line carries the optimizer hint (saw "${hint}")`);

await page.click('#btn-tool-optimizer');
check(await page.locator('#tool-bottom.hidden').count() === 1, 'the optimizer tab closes again');

// plugins
stage = 'checking the plugin sidebar';
await page.click('#btn-sidebar-plugins');
await page.waitForSelector('#plugins-sidebar-container:not(.hidden)', { timeout: 10_000 });
await page.waitForSelector('#plugins-installed-list .plugin-row', { timeout: 10_000 });
check(await page.locator('#plugins-installed-list .plugin-row').count() === 1, 'the installed plugin is listed');
check(await page.locator('#plugins-market-list .plugin-row').count() === 1, 'the marketplace lists what is not installed');

await page.fill('#plugins-search', 'lissajous');
check(await page.locator('#plugins-installed-list .plugin-row').count() === 0, 'search filters the installed list');
check(await page.locator('#plugins-market-list .plugin-row').count() === 1, 'search keeps the match');
await page.fill('#plugins-search', '');

stage = 'checking the extension page';
await page.click('#plugins-installed-list .plugin-row');
await page.waitForSelector('#plugin-page:not(.hidden)', { timeout: 10_000 });
check(await page.locator('#plugin-tab:not(.hidden)').count() === 1, 'the extension page opens as a tab');
check(
  ((await page.locator('.plugin-page-title').textContent()) ?? '').includes('Starfield'),
  'the extension page names the plugin',
);
check(await page.locator('.plugin-page-readme h2').count() === 1, 'the readme is rendered');
check(await page.locator('.plugin-tag--code').count() === 1, 'the page says the plugin runs code');

stage = 'checking a readme the app had to fetch';
await page.click('#file-tab');
await page.click('#plugins-market-list .plugin-row');
await page.waitForSelector('#plugin-page:not(.hidden)', { timeout: 10_000 });
let fetched = '';
for (let i = 0; i < 20 && !fetched.includes('Lissajous'); i++) {
  fetched = (await page.locator('.plugin-page-readme').textContent()) ?? '';
  if (!fetched.includes('Lissajous')) await page.waitForTimeout(200);
}
check(fetched.includes('Lissajous'), 'a plugin that is not installed still shows its readme');

await page.click('#plugins-installed-list .plugin-row');
await page.waitForSelector('#plugin-page:not(.hidden)', { timeout: 10_000 });

await page.click('#file-tab');
check(await page.locator('#plugin-page.hidden').count() === 1, 'the file tab comes back');
await page.click('#plugin-tab-close');
check(await page.locator('#plugin-tab.hidden').count() === 1, 'the extension tab closes');

stage = 'checking a plugin view';
await page.waitForSelector('#plugins-views .plugin-view', { timeout: 10_000 });
check(
  ((await page.locator('.plugin-view-title').first().textContent()) ?? '').includes('starfield'),
  'a view the plugin registered is drawn',
);
check(
  await page.locator('#plugins-views .plugin-widget--slider').count() === 1,
  'the slider the plugin asked for is there',
);
check(
  await page.locator('#plugins-views iframe').count() === 0,
  'a widget kind nothing knows never reaches the page',
);
check(
  ((await page.locator('#status-plugins').textContent()) ?? '').includes('stars'),
  'the plugin put an item in the status bar',
);

const sealed = (await page.locator('#status-plugins').textContent()) ?? '';
check(sealed.includes('sealed'), `the sandbox keeps the network out of reach — ${sealed}`);

stage = 'checking a plugin view event';
await page.click('#editor-container .monaco-editor');
await page.keyboard.press('Meta+A');
await page.keyboard.press('Backspace');
// the rail button toggles, so it only gets a click when the sidebar is away
if (await page.locator('#plugins-sidebar-container.hidden').count() === 1) {
  await page.click('#btn-sidebar-plugins');
}
await page.waitForSelector('#plugins-sidebar-container:not(.hidden)', { timeout: 10_000 });
await page.locator('#plugins-views .plugin-widget-btn').first().click();
let scattered = false;
for (let i = 0; i < 30 && !scattered; i++) {
  scattered = ((await page.locator('#editor-container').textContent()) ?? '').includes('@stars(');
  if (!scattered) await page.waitForTimeout(200);
}
check(scattered, 'a button in a plugin view writes into the editor');
check(
  ((await page.locator('#toast-stack').textContent()) ?? '').includes('scattered'),
  'a plugin message shows as a toast',
);

stage = 'checking a plugin macro';
await page.click('#editor-container .monaco-editor');
await page.keyboard.press('Meta+A');
await page.keyboard.type('use "starfield"\n@stars(3)\nb = twice(4)');
let drew = false;
for (let i = 0; i < 30 && !drew; i++) {
  drew = ((await page.locator('#status-msg').textContent()) ?? '').includes('4 expression');
  if (!drew) await page.waitForTimeout(250);
}
check(drew, 'a macro expands into statements the compiler draws');

await page.keyboard.press('Meta+A');
await page.keyboard.type('@nosuchmacro(1)');
let complained = false;
for (let i = 0; i < 30 && !complained; i++) {
  complained = ((await page.locator('#problems-list').textContent()) ?? '').includes('No enabled plugin');
  if (!complained) { await page.click('#btn-tool-problems'); await page.waitForTimeout(250); }
}
check(complained, 'a macro no plugin provides is reported as a problem');

check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `: ${consoleErrors[0]}` : ''}`);

clearTimeout(watchdog);
await browser.close();
await server.stop(true);

if (problems.length) {
  console.error(`\n${problems.length} smoke check(s) failed`);
  process.exit(1);
}
console.log('\nsmoke ok');
