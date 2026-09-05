const DELAY_MS = 400;

let tip: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let current: HTMLElement | null = null;

function element(): HTMLElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tip hidden';
    tip.setAttribute('role', 'tooltip');
    document.body.append(tip);
  }
  return tip;
}

export function hideTooltip(): void {
  hide();
}

function hide(): void {
  clearTimeout(timer);
  current = null;
  element().classList.add('hidden');
}

function place(host: HTMLElement, chord: string | null, text: string): void {
  const el = element();
  el.replaceChildren();
  const label = document.createElement('span');
  label.textContent = text;
  el.append(label);
  if (chord) {
    const kb = document.createElement('kbd');
    kb.className = 'tip-kb';
    kb.textContent = chord;
    el.append(kb);
  }
  el.classList.remove('hidden');

  const box = host.getBoundingClientRect();
  const own = el.getBoundingClientRect();
  const gap = 6;

  // a rail button is 40px wide, so a tooltip centred under it covers the pane beside it
  if (host.closest('.rail')) {
    const toLeft = box.left > window.innerWidth - box.right;
    const left = toLeft ? box.left - own.width - gap : box.right + gap;
    el.style.left = `${Math.min(Math.max(4, left), window.innerWidth - own.width - 4)}px`;
    el.style.top = `${Math.min(
      Math.max(4, box.top + box.height / 2 - own.height / 2),
      window.innerHeight - own.height - 4,
    )}px`;
    return;
  }

  let top = box.bottom + gap;
  if (top + own.height > window.innerHeight - 4) top = box.top - own.height - gap;
  const left = Math.min(
    Math.max(4, box.left + box.width / 2 - own.width / 2),
    window.innerWidth - own.width - 4,
  );
  el.style.top = `${Math.max(4, top)}px`;
  el.style.left = `${left}px`;
}

export function installTooltips(labelFor: (command: string) => string | null): void {
  const show = (host: HTMLElement) => {
    const text = host.dataset['tip'] ?? '';
    if (!text) return;
    current = host;
    timer = setTimeout(() => {
      if (current === host && host.isConnected) place(host, labelFor(host.dataset['chord'] ?? ''), text);
    }, DELAY_MS);
  };

  const target = (node: EventTarget | null): HTMLElement | null => {
    const el = node instanceof Element ? node.closest<HTMLElement>('[title], [data-tip]') : null;
    if (!el) return null;
    if (el.title) {
      el.dataset['tip'] = el.title;
      el.removeAttribute('title');
    }
    return el;
  };

  document.addEventListener('pointerover', e => {
    const host = target(e.target);
    if (host === current) return;
    hide();
    if (host) show(host);
  });
  document.addEventListener('focusin', e => {
    const host = target(e.target);
    hide();
    if (host) show(host);
  });
  for (const name of ['pointerdown', 'click', 'focusout', 'keydown', 'wheel', 'pointerleave']) {
    document.addEventListener(name, hide, true);
  }
}
