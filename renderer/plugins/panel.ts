import { iconEl } from '../icons';
import { matches, mergeViews } from './actions';
import { pluginIcon } from './icon';
import type { PluginActions, PluginView } from './actions';

export interface PanelElements {
  search: HTMLInputElement;
  installedList: HTMLElement;
  installedEmpty: HTMLElement;
  marketList: HTMLElement;
  marketEmpty: HTMLElement;
  refresh: HTMLButtonElement;
}

export class PluginPanel {
  private query = '';

  constructor(
    private readonly els: PanelElements,
    private readonly actions: PluginActions,
  ) {
    els.search.addEventListener('input', () => {
      this.query = els.search.value;
      this.render();
    });
    els.refresh.addEventListener('click', () => {
      void this.actions.refreshRegistry();
    });
  }

  render(): void {
    const views = mergeViews(this.actions.installed(), this.actions.registry())
      .filter(v => matches(v, this.query));

    const installed = views.filter(v => v.installed);
    const market = views.filter(v => !v.installed);

    this.fill(this.els.installedList, this.els.installedEmpty, installed);
    this.fill(this.els.marketList, this.els.marketEmpty, market);
  }

  private fill(list: HTMLElement, empty: HTMLElement, views: PluginView[]): void {
    list.replaceChildren();
    empty.classList.toggle('hidden', views.length > 0);
    for (const view of views) list.appendChild(this.row(view));
  }

  private row(view: PluginView): HTMLElement {
    const { manifest } = view;
    const li = document.createElement('li');
    li.className = 'plugin-row';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.title = manifest.description;

    const icon = pluginIcon(manifest, 'plugin-row-icon');

    const body = document.createElement('div');
    body.className = 'plugin-row-body';

    const title = document.createElement('div');
    title.className = 'plugin-row-title';
    const name = document.createElement('span');
    name.className = 'plugin-row-name';
    name.textContent = manifest.name;
    const version = document.createElement('span');
    version.className = 'plugin-row-version';
    version.textContent = `v${manifest.version}`;
    title.append(name, version);

    const desc = document.createElement('div');
    desc.className = 'plugin-row-desc';
    desc.textContent = manifest.description;

    body.append(title, desc);

    const error = this.actions.loadError(manifest.id);
    if (view.installed && view.enabled && error) {
      const warn = document.createElement('div');
      warn.className = 'plugin-row-error';
      warn.textContent = error;
      body.appendChild(warn);
    }

    const actions = document.createElement('div');
    actions.className = 'plugin-row-actions';

    if (view.installed) {
      const toggle = document.createElement('button');
      toggle.className = `plugin-toggle${view.enabled ? ' plugin-toggle--on' : ''}`;
      toggle.type = 'button';
      toggle.title = view.enabled ? 'disable' : 'enable';
      toggle.setAttribute('aria-pressed', String(view.enabled));
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        void this.actions.setEnabled(manifest.id, !view.enabled);
      });
      actions.appendChild(toggle);

      const remove = document.createElement('button');
      remove.className = 'plugin-row-btn';
      remove.type = 'button';
      remove.title = 'uninstall';
      remove.setAttribute('aria-label', `uninstall ${manifest.name}`);
      remove.appendChild(iconEl('trash-2'));
      remove.addEventListener('click', e => {
        e.stopPropagation();
        void this.actions.uninstall(manifest.id);
      });
      actions.appendChild(remove);
    } else {
      const install = document.createElement('button');
      install.className = 'plugin-row-btn plugin-row-btn--primary';
      install.type = 'button';
      install.textContent = 'install';
      install.addEventListener('click', e => {
        e.stopPropagation();
        void this.actions.install(manifest.id);
      });
      actions.appendChild(install);
    }

    li.append(icon, body, actions);

    const open = () => this.actions.openPage(manifest.id);
    li.addEventListener('click', open);
    li.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      open();
    });

    return li;
  }
}
