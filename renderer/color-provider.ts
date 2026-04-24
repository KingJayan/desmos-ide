import * as monaco from 'monaco-editor';
import { LANGUAGE_ID } from '../src/monaco/language';

export const DESMOS_NAMED: Record<string, string> = {
  red:    '#c74440',
  blue:   '#2d70b3',
  green:  '#388c46',
  orange: '#fa7e19',
  purple: '#6042a6',
  black:  '#000000',
  white:  '#ffffff',
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('');
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if      (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else                h = 60 * ((r - g) / d + 4);
  }
  return [((h % 360) + 360) % 360, max === 0 ? 0 : d / max, max];
}

const RGB_RE = /\brgb\(\s*(\d+(?:\.\d*)?)\s*,\s*(\d+(?:\.\d*)?)\s*,\s*(\d+(?:\.\d*)?)\s*\)/g;
const HSV_RE = /\bhsv\(\s*(\d+(?:\.\d*)?)\s*,\s*(\d+(?:\.\d*)?)\s*,\s*(\d+(?:\.\d*)?)\s*\)/g;
const NAMED_RE = /\bcolor\s*:\s*([a-z]+)\b/g;

function fmt(n: number, decimals = 3): number {
  return parseFloat(n.toFixed(decimals));
}

export function registerColorProvider(): void {
  monaco.languages.registerColorProvider(LANGUAGE_ID, {
    provideDocumentColors(model) {
      const text = model.getValue();
      const result: monaco.languages.IColorInformation[] = [];

      for (const m of text.matchAll(RGB_RE)) {
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        const start = model.getPositionAt(m.index!);
        const end   = model.getPositionAt(m.index! + m[0].length);
        result.push({
          color: { red: r / 255, green: g / 255, blue: b / 255, alpha: 1 },
          range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column },
        });
      }

      for (const m of text.matchAll(HSV_RE)) {
        const [h, s, v] = [+m[1], +m[2], +m[3]];
        const [r, g, b] = hsvToRgb(h, s, v);
        const start = model.getPositionAt(m.index!);
        const end   = model.getPositionAt(m.index! + m[0].length);
        result.push({
          color: { red: r / 255, green: g / 255, blue: b / 255, alpha: 1 },
          range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column },
        });
      }

      for (const m of text.matchAll(NAMED_RE)) {
        const name = m[1];
        const hex  = DESMOS_NAMED[name];
        if (!hex) continue;
        const nameOffset = m.index! + m[0].lastIndexOf(name);
        const start = model.getPositionAt(nameOffset);
        const end   = model.getPositionAt(nameOffset + name.length);
        const [r, g, b] = hexToRgb(hex);
        result.push({
          color: { red: r / 255, green: g / 255, blue: b / 255, alpha: 1 },
          range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column },
        });
      }

      return result;
    },

    provideColorPresentations(_model, colorInfo) {
      const { red, green, blue } = colorInfo.color;
      const r = Math.round(red * 255), g = Math.round(green * 255), b = Math.round(blue * 255);
      const [h, s, v] = rgbToHsv(r, g, b);

      const presentations: monaco.languages.IColorPresentation[] = [
        { label: `rgb(${r}, ${g}, ${b})` },
        { label: `hsv(${Math.round(h)}, ${fmt(s)}, ${fmt(v)})` },
      ];

      const closestNamed = Object.entries(DESMOS_NAMED).find(([, hex]) => {
        const [nr, ng, nb] = hexToRgb(hex);
        return Math.abs(nr - r) + Math.abs(ng - g) + Math.abs(nb - b) < 5;
      });
      if (closestNamed) {
        presentations.unshift({ label: closestNamed[0] });
      }

      return presentations;
    },
  });
}
