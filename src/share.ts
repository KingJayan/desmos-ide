// a share link carries the dsmx source itself, so the page that opens it can
// compile and the reader keeps something editable. desmos has no public api for
// putting graph state in a url, so the docs site is what draws it

export const SHARE_BASE = 'https://desmos-ide.vercel.app/share';

const RAW = '1';
const DEFLATED = '2';

/** a url is not unlimited, and a fragment this long is unusable in a chat window */
export const MAX_SHARE_CHARS = 12_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const out = await new Response(blob.stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

/** deflate when the runtime has CompressionStream, plain base64 when it does not */
export async function encodeShare(src: string): Promise<string> {
  const bytes = new TextEncoder().encode(src);
  if (typeof CompressionStream === 'function') {
    try {
      return DEFLATED + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch {
      // fall through to the plain form
    }
  }
  return RAW + toBase64Url(bytes);
}

export async function decodeShare(token: string): Promise<string | null> {
  const tag = token.slice(0, 1);
  const body = token.slice(1);
  if (!body) return null;
  try {
    const bytes = fromBase64Url(body);
    if (tag === RAW) return new TextDecoder().decode(bytes);
    if (tag !== DEFLATED) return null;
    if (typeof DecompressionStream !== 'function') return null;
    return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
  } catch {
    return null;
  }
}

export async function shareUrl(src: string, base = SHARE_BASE): Promise<string | null> {
  const token = await encodeShare(src);
  const url = `${base}#c=${token}`;
  return url.length > MAX_SHARE_CHARS ? null : url;
}

/** reads the token back out of a `#c=…` fragment */
export function shareToken(hash: string): string | null {
  const match = /[#&]c=([A-Za-z0-9\-_]+)/.exec(hash);
  return match ? match[1]! : null;
}
