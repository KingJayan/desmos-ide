import type { View, Widget } from '../../src/plugin/contributions';


export type OnWidget = (plugin: string, view: string, widget: string, value: string | number | boolean | null) => void;

export interface PanelView {
  plugin: string;
  view: View;
}

export class PluginViews {
  constructor(
    private readonly root: HTMLElement,
    private readonly onWidget: OnWidget,
  ) {}

  render(views: PanelView[]): void {
    this.root.replaceChildren();
    this.root.classList.toggle('hidden', views.length === 0);
    for (const { plugin, view } of views) this.root.appendChild(this.section(plugin, view));
  }

  private section(plugin: string, view: View): HTMLElement {
    const section = document.createElement('section');
    section.className = 'plugin-view';
    section.dataset['plugin'] = plugin;
    section.dataset['view'] = view.id;

    const header = document.createElement('div');
    header.className = 'plugin-view-title';
    header.textContent = view.title;
    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'plugin-view-body';
    for (const widget of view.widgets) body.appendChild(this.widget(plugin, view.id, widget));
    section.appendChild(body);

    return section;
  }

  private fire(plugin: string, view: string, widget: string, value: string | number | boolean | null): void {
    this.onWidget(plugin, view, widget, value);
  }

  private widget(plugin: string, view: string, w: Widget): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `plugin-widget plugin-widget--${w.kind}`;

    switch (w.kind) {
      case 'separator':
        wrap.appendChild(document.createElement('hr'));
        return wrap;

      case 'label': {
        const p = document.createElement('p');
        p.className = w.muted ? 'plugin-widget-label plugin-widget-label--muted' : 'plugin-widget-label';
        p.textContent = w.text;
        wrap.appendChild(p);
        return wrap;
      }

      case 'button': {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `plugin-widget-btn${w.primary ? ' plugin-widget-btn--primary' : ''}`;
        btn.textContent = w.label;
        btn.addEventListener('click', () => this.fire(plugin, view, w.id, null));
        wrap.appendChild(btn);
        return wrap;
      }

      case 'input': {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'plugin-widget-input';
        input.value = w.value ?? '';
        if (w.placeholder) input.placeholder = w.placeholder;
        input.setAttribute('aria-label', w.label ?? w.id);
        // a value each keystroke would run the plugin on every letter
        input.addEventListener('change', () => this.fire(plugin, view, w.id, input.value));
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') this.fire(plugin, view, w.id, input.value);
        });
        wrap.append(this.label(w.label, w.id), input);
        return wrap;
      }

      case 'slider': {
        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'plugin-widget-slider';
        input.min = String(w.min);
        input.max = String(w.max);
        input.step = String(w.step ?? 1);
        input.value = String(w.value);
        input.setAttribute('aria-label', w.label ?? w.id);

        const shown = document.createElement('span');
        shown.className = 'plugin-widget-value';
        shown.textContent = String(w.value);
        input.addEventListener('input', () => { shown.textContent = input.value; });
        input.addEventListener('change', () => this.fire(plugin, view, w.id, Number(input.value)));

        const head = this.label(w.label, w.id);
        head.appendChild(shown);
        wrap.append(head, input);
        return wrap;
      }

      case 'checkbox': {
        const label = document.createElement('label');
        label.className = 'plugin-widget-check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = w.value ?? false;
        input.addEventListener('change', () => this.fire(plugin, view, w.id, input.checked));
        const text = document.createElement('span');
        text.textContent = w.label;
        label.append(input, text);
        wrap.appendChild(label);
        return wrap;
      }

      case 'select': {
        const select = document.createElement('select');
        select.className = 'plugin-widget-select';
        select.setAttribute('aria-label', w.label ?? w.id);
        for (const option of w.options) {
          const el = document.createElement('option');
          el.value = option.value;
          el.textContent = option.label;
          if (option.value === w.value) el.selected = true;
          select.appendChild(el);
        }
        select.addEventListener('change', () => this.fire(plugin, view, w.id, select.value));
        wrap.append(this.label(w.label, w.id), select);
        return wrap;
      }

      case 'rows': {
        const list = document.createElement('ul');
        list.className = 'plugin-widget-rows';
        for (const row of w.rows) {
          const li = document.createElement('li');
          li.className = 'plugin-widget-row';

          const title = document.createElement('span');
          title.className = 'plugin-widget-row-title';
          title.textContent = row.title;
          li.appendChild(title);

          if (row.detail) {
            const detail = document.createElement('span');
            detail.className = 'plugin-widget-row-detail';
            detail.textContent = row.detail;
            li.appendChild(detail);
          }

          // only a row with an id can be clicked, since the plugin needs to name it
          if (row.id) {
            const rowId = row.id;
            li.classList.add('plugin-widget-row--clickable');
            li.tabIndex = 0;
            li.setAttribute('role', 'button');
            li.addEventListener('click', () => this.fire(plugin, view, rowId, null));
            li.addEventListener('keydown', e => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              this.fire(plugin, view, rowId, null);
            });
          }
          list.appendChild(li);
        }
        wrap.appendChild(list);
        return wrap;
      }
    }
  }

  private label(text: string | undefined, fallback: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'plugin-widget-head';
    const span = document.createElement('span');
    span.textContent = text ?? fallback;
    el.appendChild(span);
    return el;
  }
}
