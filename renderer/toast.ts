import { iconEl } from './icons';
import type { IconName } from './icons';


export type ToastKind = 'info' | 'warning' | 'error';

const LIFETIME: Record<ToastKind, number> = { info: 4000, warning: 7000, error: 10_000 };
const ICONS: Record<ToastKind, IconName> = { info: 'info', warning: 'triangle-alert', error: 'circle-x' };
const MAX = 4;

export class Toasts {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div');
    this.root.className = 'toast-stack';
    this.root.id = 'toast-stack';
    this.root.setAttribute('role', 'log');
    this.root.setAttribute('aria-live', 'polite');
    parent.appendChild(this.root);
  }

  show(kind: ToastKind, text: string, source?: string): void {
    if (!text.trim()) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${kind}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.appendChild(iconEl(ICONS[kind], { size: 14 }));

    const body = document.createElement('div');
    body.className = 'toast-body';
    if (source) {
      const from = document.createElement('div');
      from.className = 'toast-source';
      from.textContent = source;
      body.appendChild(from);
    }
    const message = document.createElement('div');
    message.className = 'toast-text';
    message.textContent = text;
    body.appendChild(message);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'dismiss');
    close.appendChild(iconEl('x', { size: 12 }));

    const drop = () => {
      clearTimeout(timer);
      toast.classList.add('toast--leaving');
      setTimeout(() => toast.remove(), 160);
    };
    close.addEventListener('click', drop);
    const timer = setTimeout(drop, LIFETIME[kind]);

    toast.append(icon, body, close);
    this.root.appendChild(toast);

    while (this.root.childElementCount > MAX) this.root.firstElementChild?.remove();
  }
}
