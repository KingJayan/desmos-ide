import { iconEl } from '../icons';
import { mergeViews } from './actions';
import type { PluginActions } from './actions';
import { markdownToHtml } from '../markdown';
import { pluginIcon } from './icon';
import type { InstalledPlugin } from '../../src/plugin/manifest';

/** the extension page, shown as an editor tab the way an ide shows a readme */
export class PluginPage {
  private id: string | null = null;
  // the readme of a plugin nobody installed comes off the registry, so the page reads
  // the same before an install as after one
  private readmes = new Map<string, string | null>();

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: PluginActions,
  ) {}

  get openId(): string | null {
    return this.id;
  }

  show(id: string): void {
    this.id = id;
    this.render();
  }

  close(): void {
    this.id = null;
  }

  render(): void {
    if (!this.id) return;
    const id = this.id;
    const view = mergeViews(this.actions.installed(), this.actions.registry()).find(v => v.manifest.id === id);

    this.root.replaceChildren();
    if (!view) {
      const missing = document.createElement('div');
      missing.className = 'plugin-page-empty';
      missing.textContent = `Nothing here knows about '${id}'. It may have left the marketplace.`;
      this.root.appendChild(missing);
      return;
    }

    const { manifest } = view;
    const local = this.actions.installed().find(p => p.manifest.id === id) ?? null;

    this.root.appendChild(this.header(view.installed, view.enabled, manifest, local));
    this.root.appendChild(this.body(id, manifest, local));
  }

  private header(
    installed: boolean,
    enabled: boolean,
    manifest: InstalledPlugin['manifest'],
    local: InstalledPlugin | null,
  ): HTMLElement {
    const head = document.createElement('header');
    head.className = 'plugin-page-head';

    const icon = pluginIcon(manifest, 'plugin-page-icon');

    const meta = document.createElement('div');
    meta.className = 'plugin-page-meta';

    const title = document.createElement('h1');
    title.className = 'plugin-page-title';
    title.textContent = manifest.name;

    const facts = document.createElement('div');
    facts.className = 'plugin-page-facts';
    const shown = [manifest.author, `v${manifest.version}`, manifest.license].filter((t): t is string => !!t);
    for (const text of shown) {
      const fact = document.createElement('span');
      fact.className = 'plugin-page-fact';
      fact.textContent = text;
      facts.appendChild(fact);
    }

    const desc = document.createElement('p');
    desc.className = 'plugin-page-desc';
    desc.textContent = manifest.description;

    const actions = document.createElement('div');
    actions.className = 'plugin-page-actions';

    if (!installed) {
      actions.appendChild(this.button('install', 'primary', () => this.actions.install(manifest.id)));
    } else {
      actions.appendChild(this.button(
        enabled ? 'disable' : 'enable',
        'plain',
        () => this.actions.setEnabled(manifest.id, !enabled),
      ));
      actions.appendChild(this.button('uninstall', 'plain', () => this.actions.uninstall(manifest.id)));
    }

    if (manifest.homepage) {
      const link = this.button('homepage', 'plain', async () => {
        this.actions.openExternal(manifest.homepage!);
      });
      link.prepend(iconEl('external-link'));
      actions.appendChild(link);
    }

    meta.append(title, facts, desc, actions);

    const error = local && local.enabled ? this.actions.loadError(manifest.id) : null;
    if (error) {
      const warn = document.createElement('div');
      warn.className = 'plugin-page-error';
      warn.textContent = `This plugin did not load: ${error}`;
      meta.appendChild(warn);
    }

    head.append(icon, meta);
    return head;
  }

  private body(id: string, manifest: InstalledPlugin['manifest'], local: InstalledPlugin | null): HTMLElement {
    const body = document.createElement('div');
    body.className = 'plugin-page-body';

    const contributes = this.contributions(manifest, local);
    if (contributes) body.appendChild(contributes);

    const readme = document.createElement('article');
    readme.className = 'plugin-page-readme';

    const text = local?.readme ?? this.readmes.get(id) ?? null;
    if (text) {
      readme.innerHTML = markdownToHtml(text);
    } else if (this.readmes.has(id)) {
      readme.innerHTML = '<p>This plugin ships no readme.</p>';
    } else {
      readme.innerHTML = '<p>Reading the readme…</p>';
      void this.fetchReadme(id);
    }
    body.appendChild(readme);

    return body;
  }

  private async fetchReadme(id: string): Promise<void> {
    this.readmes.set(id, (await window.electronAPI?.pluginReadme(id)) ?? null);
    if (this.id === id) this.render();
  }

  private contributions(manifest: InstalledPlugin['manifest'], local: InstalledPlugin | null): HTMLElement | null {
    const rows: [string, string][] = [];
    if (manifest.lib) rows.push(['dsl', 'Adds functions you can call from any file']);
    if (manifest.main) rows.push(['code', 'Runs sandboxed javascript for generators and commands']);
    if (manifest.theme) rows.push(['theme', 'Adds an editor color theme']);
    if (local?.enabled === false) rows.push(['off', 'Installed, but not enabled']);
    if (rows.length === 0) return null;

    const list = document.createElement('div');
    list.className = 'plugin-page-contributes';
    for (const [tag, text] of rows) {
      const row = document.createElement('div');
      row.className = 'plugin-contributes-row';
      const badge = document.createElement('span');
      badge.className = `plugin-tag plugin-tag--${tag}`;
      badge.textContent = tag;
      const what = document.createElement('span');
      what.textContent = text;
      row.append(badge, what);
      list.appendChild(row);
    }
    return list;
  }

  private button(label: string, kind: 'primary' | 'plain', run: () => Promise<void> | void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `plugin-page-btn${kind === 'primary' ? ' plugin-page-btn--primary' : ''}`;
    btn.append(document.createTextNode(label));
    btn.addEventListener('click', () => { void run(); });
    return btn;
  }
}
