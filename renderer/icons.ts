// unified icon source for all ui

import {
  ArrowDown, Check, ChevronDown, ChevronRight, CircleX, Copy, ExternalLink, FileCode, FileText, FolderOpen,
  Info, Pause, Play, Plus, Puzzle, RefreshCw, Search, Send, Square, SquarePen, Trash2,
  TriangleAlert, X,
} from 'lucide';
import { escapeHtml } from '../src/shared/escape';

type IconNode = [tag: string, attrs: Record<string, string | number>, children?: IconNode][];

const DsmxMark: IconNode = [
  ['rect', {
    width: '24',
    height: '24',
    rx: '5',
    fill: '#202223',
  }],

  // graph grid
  ['g', {
    fill: 'none',
    stroke: '#17191a',
    'stroke-width': '0.65',
  }, [
    ['path', { d: 'M6 0v24' }],
    ['path', { d: 'M12 0v24' }],
    ['path', { d: 'M18 0v24' }],
    ['path', { d: 'M0 6h24' }],
    ['path', { d: 'M0 12h24' }],
    ['path', { d: 'M0 18h24' }],
  ]],

  // secondary traces
  ['g', {
    fill: 'none',
    stroke: '#4b5563',
    'stroke-width': '0.7',
    'stroke-linecap': 'round',
  }, [
    ['path', {
      d: 'M1.5 8 C4 8 5.5 17 9 17 C12 17 13 7 16 7 C19 7 20 15.5 22.5 15.5',
    }],
    ['path', {
      d: 'M1.5 9.2 C4 9.2 5.5 16 9 16 C12 16 13 8.2 16 8.2 C19 8.2 20 14.3 22.5 14.3',
    }],
    ['path', {
      d: 'M1.5 10.4 C4 10.4 5.5 15 9 15 C12 15 13 9.4 16 9.4 C19 9.4 20 13.1 22.5 13.1',
    }],
  ]],

  // primary trace
  ['path', {
    d: 'M1.5 5 C4.5 5 5.5 18.5 9 18.5 C12.5 18.5 13 5.5 16 5.5 C19 5.5 20 15.5 22.5 15.5',
    fill: 'none',
    stroke: '#2f80d0',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
  }],

  // subtle draggable point
  ['circle', {
    cx: '9',
    cy: '18.5',
    r: '1.15',
    fill: '#2f80d0',
  }],
];

const ICONS = {
  'dsmx-mark': DsmxMark,
  'arrow-down': ArrowDown as IconNode,
  check: Check as IconNode,
  plus: Plus as IconNode,
  'chevron-down': ChevronDown as IconNode,
  'chevron-right': ChevronRight as IconNode,
  'circle-x': CircleX as IconNode,
  copy: Copy as IconNode,
  info: Info as IconNode,
  'triangle-alert': TriangleAlert as IconNode,
  'external-link': ExternalLink as IconNode,
  puzzle: Puzzle as IconNode,
  'refresh-cw': RefreshCw as IconNode,
  'trash-2': Trash2 as IconNode,
  'file-code': FileCode as IconNode,
  'file-text': FileText as IconNode,
  'folder-open': FolderOpen as IconNode,
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

