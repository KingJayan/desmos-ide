/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { emptyContributions, parseContributions, parseKey, resolveKeys } from '../plugin/contributions';
import { renderMarkdown } from '../plugin/markdown';
import { iconIsImage, imageType, parseManifest, pluginFiles } from '../plugin/manifest';

const GOOD = {
  id: 'polar-lab',
  name: 'Polar Lab',
  version: '1.0.0',
  description: 'draws things',
  author: 'someone',
  main: 'main.js',
};

describe('an icon is a picture or a character', () => {
  test('a picture the plugin ships is kept, and comes with the files', () => {
    const m = parseManifest({ ...GOOD, icon: 'icon.svg' });
    assert.equal(m?.icon, 'icon.svg');
    assert.equal(iconIsImage(m?.icon), true);
    assert.ok(pluginFiles(m!).includes('icon.svg'));
  });

  test('a character icon is kept, and adds no file', () => {
    const m = parseManifest({ ...GOOD, icon: '✦' });
    assert.equal(m?.icon, '✦');
    assert.equal(iconIsImage(m?.icon), false);
    assert.equal(pluginFiles(m!).includes('✦'), false);
  });

  test('a picture that climbs out of the plugin folder is dropped', () => {
    assert.equal(parseManifest({ ...GOOD, icon: '../../secret.png' })?.icon, undefined);
  });

  test('a long run of characters is not an icon', () => {
    assert.equal(parseManifest({ ...GOOD, icon: 'a much longer label' })?.icon, undefined);
  });

  test('only the three picture types have a media type', () => {
    assert.equal(imageType('a.svg'), 'image/svg+xml');
    assert.equal(imageType('a.PNG'), 'image/png');
    assert.equal(imageType('a.gif'), null);
  });
});

describe('a widget the sandbox reports is rebuilt, not trusted', () => {
  const parse = (widgets: unknown[]) =>
    parseContributions('p', { views: [{ id: 'v', title: 'V', widgets }] }).views[0]!.widgets;

  test('every kind survives when it is complete', () => {
    const kinds = parse([
      { kind: 'label', text: 'hello' },
      { kind: 'button', id: 'go', label: 'Go' },
      { kind: 'input', id: 'name' },
      { kind: 'slider', id: 'k', value: 3, min: 1, max: 10 },
      { kind: 'checkbox', id: 'on', label: 'On' },
      { kind: 'select', id: 's', options: [{ value: 'a', label: 'A' }] },
      { kind: 'rows', rows: [{ title: 'one' }] },
      { kind: 'separator' },
    ]).map(w => w.kind);
    assert.deepEqual(kinds, ['label', 'button', 'input', 'slider', 'checkbox', 'select', 'rows', 'separator']);
  });

  test('a kind nothing knows is dropped', () => {
    assert.deepEqual(parse([{ kind: 'iframe', src: 'https://x.dev' }]), []);
  });

  test('a widget with no id is dropped, since an event could not name it', () => {
    assert.deepEqual(parse([{ kind: 'button', label: 'Go' }]), []);
  });

  test('two widgets may not share an id', () => {
    const out = parse([
      { kind: 'button', id: 'go', label: 'One' },
      { kind: 'button', id: 'go', label: 'Two' },
    ]);
    assert.equal(out.length, 1);
    assert.equal((out[0] as { label: string }).label, 'One');
  });

  test('a slider value is held inside its own range', () => {
    const [w] = parse([{ kind: 'slider', id: 'k', value: 99, min: 1, max: 10 }]);
    assert.equal((w as { value: number }).value, 10);
  });

  test('a slider with no range at all is dropped', () => {
    assert.deepEqual(parse([{ kind: 'slider', id: 'k', value: 3, min: 10, max: 1 }]), []);
  });

  test('a select value that is not one of its options is dropped', () => {
    const [w] = parse([{ kind: 'select', id: 's', value: 'z', options: [{ value: 'a', label: 'A' }] }]);
    assert.equal((w as { value?: string }).value, undefined);
  });

  test('a select with no usable option is dropped whole', () => {
    assert.deepEqual(parse([{ kind: 'select', id: 's', options: [{ label: 'no value' }] }]), []);
  });

  test('a view with no id or title is not a view', () => {
    assert.deepEqual(parseContributions('p', { views: [{ title: 'V' }, { id: 'v' }] }).views, []);
  });

  test('nothing at all reads as nothing contributed', () => {
    assert.deepEqual(parseContributions('p', null), emptyContributions('p'));
  });
});

describe('a plugin key has to carry Alt', () => {
  test('a combo with Alt is read, and comes back in one spelling', () => {
    assert.equal(parseKey('Alt+S'), 'alt+s');
    assert.equal(parseKey('shift+ALT+p'), 'alt+shift+p');
    assert.equal(parseKey('Alt+F5'), 'alt+f5');
    assert.equal(parseKey('Alt+3'), 'alt+3');
  });

  test('a combo the app owns is refused', () => {
    for (const key of ['Meta+S', 'Ctrl+F', 'Shift+Meta+F', 'S']) {
      assert.equal(parseKey(key), null, key);
    }
  });

  test('a modifier nothing knows, or one twice, is refused', () => {
    assert.equal(parseKey('Alt+Hyper+S'), null);
    assert.equal(parseKey('Alt+Alt+S'), null);
  });

  test('a base key that is not one key is refused', () => {
    assert.equal(parseKey('Alt+Enter+S'), null);
    assert.equal(parseKey('Alt+F13'), null);
  });
});

describe('two plugins can want one combo', () => {
  const held = (plugin: string, key: string) => ({
    ...emptyContributions(plugin),
    keys: [{ key, command: 'go' }],
  });

  test('the first to load keeps it', () => {
    const { owned, clashes } = resolveKeys([held('first', 'alt+s'), held('second', 'alt+s')]);
    assert.equal(owned.get('alt+s')?.plugin, 'first');
    assert.deepEqual(clashes.get('second'), ['alt+s']);
    assert.equal(clashes.has('first'), false);
  });

  test('combos nobody else wants are all kept', () => {
    const { owned, clashes } = resolveKeys([held('first', 'alt+s'), held('second', 'alt+p')]);
    assert.equal(owned.size, 2);
    assert.equal(clashes.size, 0);
  });
});

describe('a readme is escaped before it is marked up', () => {
  test('a tag an author wrote is text, not a tag', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    assert.equal(html.includes('<script'), false);
    assert.ok(html.includes('&lt;script'));
  });

  test('the marks it knows come through', () => {
    assert.ok(renderMarkdown('# Title').includes('<h2>Title</h2>'));
    assert.ok(renderMarkdown('- one\n- two').includes('<ul><li>one</li><li>two</li></ul>'));
    assert.ok(renderMarkdown('1. one\n2. two').includes('<ol>'));
    assert.ok(renderMarkdown('> quoted').includes('<blockquote>'));
    assert.ok(renderMarkdown('---').includes('<hr />'));
    assert.ok(renderMarkdown('`code`').includes('<code>code</code>'));
  });

  test('a link has to be https, and anything else stays as text', () => {
    assert.ok(renderMarkdown('[x](https://a.dev)').includes('href="https://a.dev"'));
    const bad = renderMarkdown('[x](javascript:alert(1))');
    assert.equal(bad.includes('href'), false);
  });

  test('a relative image is only shown when the caller can place it', () => {
    assert.equal(renderMarkdown('![shot](shot.png)').includes('<img'), false);
    const placed = renderMarkdown('![shot](shot.png)', src => `https://cdn.dev/${src}`);
    assert.ok(placed.includes('src="https://cdn.dev/shot.png"'));
  });

  test('a fence keeps its contents whole', () => {
    const html = renderMarkdown('```\n# not a heading\n```');
    assert.ok(html.includes('<pre><code># not a heading</code></pre>'));
  });
});

describe('plugin storage refuses anything that is not its own', () => {
  test('a bad id writes nothing and says so', async () => {
    const { updatePluginState, getPluginSecret, setSyncKeys } = await import('../../bun/plugin-storage');
    for (const id of ['../escape', 'Upper', 'a', 'has space', 'a/b']) {
      assert.equal(await updatePluginState(id, 'global', null, 'k', 1), false, id);
      assert.equal(await setSyncKeys(id, ['k']), false, id);
      assert.equal(await getPluginSecret(id, 'k'), null, id);
    }
  });

  test('a key that is not a plain key writes nothing', async () => {
    const { updatePluginState } = await import('../../bun/plugin-storage');
    for (const key of ['../out', 'a/b', '', 'x'.repeat(65)]) {
      assert.equal(await updatePluginState('polar-lab', 'global', null, key, 1), false, key);
    }
  });

  test('workspace state has nowhere to go before a file has a folder', async () => {
    const { updatePluginState, pluginState } = await import('../../bun/plugin-storage');
    assert.equal(await updatePluginState('polar-lab', 'workspace', null, 'k', 1), false);
    assert.deepEqual((await pluginState('../escape', null)).global, {});
  });
});

describe('the main process only reads a path the user gave it', () => {
  const load = () => import('../../bun/paths');

  test('nothing is reachable before a dialog picks something', async () => {
    const { allowed, allowedRoot } = await load();
    assert.equal(allowed('/etc/passwd'), null);
    assert.equal(allowedRoot('/'), null);
  });

  test('a picked file is reachable, and so is the folder it sits in', async () => {
    const { allowFile, allowed } = await load();
    allowFile('/Users/someone/graphs/one.dsmx');
    assert.equal(allowed('/Users/someone/graphs/one.dsmx'), '/Users/someone/graphs/one.dsmx');
    assert.equal(allowed('/Users/someone/graphs/two.dsmx'), '/Users/someone/graphs/two.dsmx');
    assert.equal(allowed('/Users/someone/other.dsmx'), null);
  });

  test('a relative path is measured after it is resolved', async () => {
    const { allowRoot, allowed } = await load();
    allowRoot('/Users/someone/work');
    assert.equal(allowed('/Users/someone/work/../../secret'), null);
    assert.equal(allowed('/Users/someone/work/./deep/file.dsmx'), '/Users/someone/work/deep/file.dsmx');
  });

  test('a folder name that only starts the same is not inside it', async () => {
    const { allowRoot, allowed } = await load();
    allowRoot('/Users/someone/work');
    assert.equal(allowed('/Users/someone/work-notes/file.dsmx'), null);
  });

  test('a path that is not a string reaches nothing', async () => {
    const { allowed, allowFile } = await load();
    for (const bad of [null, undefined, 42, '', {}]) {
      assert.equal(allowed(bad), null);
      assert.equal(allowFile(bad), null);
    }
  });
});
