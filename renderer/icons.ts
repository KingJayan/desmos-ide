// one icon source for the whole UI

import {
  Check, ChevronRight, Copy, FileText, Pause, Play, Search, Send, Square, SquarePen, X,
} from 'lucide';
import { escapeHtml } from './escape';

type IconNode = [tag: string, attrs: Record<string, string | number>][];

const ICONS = {
  check: Check as IconNode,
  'chevron-right': ChevronRight as IconNode,
  copy: Copy as IconNode,
  'file-text': FileText as IconNode,
  pause: Pause as IconNode,
  play: Play as IconNode,
  search: Search as IconNode,
  send: Send as IconNode,
  square: Square as IconNode,
  'square-pen': SquarePen as IconNode,
  x: X as IconNode,
};

export type IconName = keyof typeof ICONS;

export interface IconOptions {
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function rootAttrs(opts: IconOptions): Record<string, string> {
  const size = String(opts.size ?? 14);
  return {
    xmlns: SVG_NS,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: opts.filled ? 'currentColor' : 'none',
    stroke: 'currentColor',
    'stroke-width': String(opts.strokeWidth ?? 2),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  };
}

export function iconEl(name: IconName, opts: IconOptions = {}): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries(rootAttrs(opts))) svg.setAttribute(k, v);
  for (const [tag, attrs] of ICONS[name]) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) child.setAttribute(k, String(v));
    svg.appendChild(child);
  }
  return svg;
}

/** for the places that build their markup as a string */
export function iconSvg(name: IconName, opts: IconOptions = {}): string {
  const attrs = (a: Record<string, string | number>) =>
    Object.entries(a).map(([k, v]) => `${k}="${escapeHtml(String(v))}"`).join(' ');
  const body = ICONS[name].map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('');
  return `<svg ${attrs(rootAttrs(opts))}>${body}</svg>`;
}

