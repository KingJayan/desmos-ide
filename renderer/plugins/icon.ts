import { iconEl } from '../icons';
import { iconIsImage } from '../../src/plugin/manifest';
import type { PluginManifest } from '../../src/plugin/manifest';


const cache = new Map<string, string | null>();
const asked = new Map<string, Promise<string | null>>();

function load(id: string): Promise<string | null> {
  const held = asked.get(id);
  if (held) return held;

  const request = (window.electronAPI?.pluginIcon(id) ?? Promise.resolve(null))
    .then(uri => {
      cache.set(id, uri);
      return uri;
    })
    .catch(() => null);
  asked.set(id, request);
  return request;
}

export function pluginIcon(manifest: PluginManifest, className: string): HTMLElement {
  const el = document.createElement('span');
  el.className = className;

  if (!iconIsImage(manifest.icon)) {
    if (manifest.icon) el.textContent = manifest.icon;
    else el.appendChild(iconEl('puzzle', { size: 26 }));
    return el;
  }

  const held = cache.get(manifest.id);
  if (held) {
    el.appendChild(image(held, manifest.name));
    return el;
  }

  el.appendChild(iconEl('puzzle', { size: 26 }));
  void load(manifest.id).then(uri => {
    if (!uri) return;
    el.replaceChildren();
    el.appendChild(image(uri, manifest.name));
  });
  return el;
}

function image(uri: string, name: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'plugin-icon-img';
  img.src = uri;
  img.alt = `${name} icon`;
  return img;
}

export function forgetIcon(id: string): void {
  cache.delete(id);
  asked.delete(id);
}
