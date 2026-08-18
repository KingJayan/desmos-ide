import type { MenuArea, MenuItem } from '../../src/plugin/contributions';


export type RunMenuItem = (plugin: string, command: string) => void;

export interface MenuSource {
  menuItems(area: MenuArea): { plugin: string; item: MenuItem }[];
}

export class PluginContextMenu {
  private el: HTMLElement | null = null;

  constructor(
    private readonly source: MenuSource,
    private readonly run: RunMenuItem,
  ) {
    document.addEventListener('mousedown', e => {
      if (this.el && !this.el.contains(e.target as Node)) this.close();
    }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    window.addEventListener('blur', () => this.close());
  }

  attach(area: MenuArea, target: HTMLElement): void {
    target.addEventListener('contextmenu', e => {
      const items = this.source.menuItems(area);
      if (items.length === 0) return;
      e.preventDefault();
      this.open(items, e.clientX, e.clientY);
    });
  }

  close(): void {
    this.el?.remove();
    this.el = null;
  }

  private open(items: { plugin: string; item: MenuItem }[], x: number, y: number): void {
    this.close();

    const menu = document.createElement('div');
    menu.className = 'plugin-menu';
    menu.setAttribute('role', 'menu');

    for (const { plugin, item } of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'plugin-menu-item';
      button.setAttribute('role', 'menuitem');

      const label = document.createElement('span');
      label.textContent = item.label;
      const from = document.createElement('span');
      from.className = 'plugin-menu-from';
      from.textContent = plugin;

      button.append(label, from);
      button.addEventListener('click', () => {
        this.close();
        this.run(plugin, item.command);
      });
      menu.appendChild(button);
    }

    document.body.appendChild(menu);
    this.el = menu;

    const box = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - box.width - 8);
    const top = Math.min(y, window.innerHeight - box.height - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;

    menu.querySelector('button')?.focus();
  }
}
