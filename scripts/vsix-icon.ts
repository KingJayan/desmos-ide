import { deflateSync } from 'node:zlib';

const SIZE = 128;
const SS = 4;

type RGB = [number, number, number];

const CRUST: RGB = [17, 17, 27];
const SURFACE: RGB = [49, 50, 68];
const MAUVE: RGB = [203, 166, 247];

const mix = (a: RGB, b: RGB, t: number): RGB =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as RGB;

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** the dsmx mark: a parabola and its axes on the app background */
function shade(x: number, y: number): RGB {
  const gx = (x / SIZE) * 4 - 2;
  const gy = 1.35 - (y / SIZE) * 3.2;

  const axis = Math.min(Math.abs(gx), Math.abs(gy));
  const curve = Math.abs(gy - (gx * gx - 1.05));

  if (curve < 0.16) return MAUVE;
  if (axis < 0.035) return mix(CRUST, SURFACE, 0.9);
  return CRUST;
}

function pixels(): Uint8Array {
  const raw = new Uint8Array(SIZE * (SIZE * 4 + 1));
  const radius = 26;
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[p++] = 0;
    for (let x = 0; x < SIZE; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (!inRoundedSquare(px, py, radius)) continue;
          const [cr, cg, cb] = shade(px, py);
          r += cr; g += cg; b += cb; a += 255;
        }
      }
      const n = SS * SS;
      const cover = a / (n * 255);
      raw[p++] = cover ? Math.round(r / (n * cover)) : 0;
      raw[p++] = cover ? Math.round(g / (n * cover)) : 0;
      raw[p++] = cover ? Math.round(b / (n * cover)) : 0;
      raw[p++] = Math.round(cover * 255);
    }
  }
  return raw;
}

function inRoundedSquare(x: number, y: number, radius: number): boolean {
  const dx = Math.max(radius - x, x - (SIZE - radius), 0);
  const dy = Math.max(radius - y, y - (SIZE - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
}

export function iconPng(): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, SIZE);
  view.setUint32(4, SIZE);
  header[8] = 8;
  header[9] = 6;

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(pixels(), { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ];

  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}
