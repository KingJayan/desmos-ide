import type { DesmosState } from '../src/compile';

export const DESMOS_API = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';

export interface PageOptions {
  title: string;
  theme: 'dark' | 'light';
  live: boolean;
  error: string | null;
}

const THEMES = {
  dark: { page: '#1e1e2e', background: '#24273a', text: '#7f849c', dim: '#7f849c', fillScale: 1 },
  light: { page: '#eff1f5', background: '#eff1f5', text: '#9ca0b0', dim: '#8c8fa1', fillScale: 0.55 },
} as const;

/** JSON that is safe to sit inside a script element */
export function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * an expression carries fillOpacity as a string, and a light background needs less
 * of it for the same weight, so the number is scaled on the way to desmos only
 */
export function scaleFills(state: DesmosState, scale: number): DesmosState {
  if (scale === 1) return state;
  const list = state.expressions.list.map(expr => {
    if (expr.fillOpacity === undefined) return expr;
    const n = Number(expr.fillOpacity);
    if (!Number.isFinite(n)) return expr;
    return { ...expr, fillOpacity: String(Math.round(n * scale * 1000) / 1000) };
  });
  return { ...state, expressions: { list } };
}

export function buildPage(state: DesmosState, opts: PageOptions): string {
  const theme = THEMES[opts.theme];
  const scaled = scaleFills(state, theme.fillScale);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>
  html, body { margin: 0; height: 100%; background: ${theme.page}; }
  #graph { position: absolute; inset: 0; }
  #banner {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 5;
    display: none; padding: 10px 14px;
    background: #f38ba8; color: #11111b;
    font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre-wrap;
  }
  #name {
    position: absolute; left: 12px; top: 10px; z-index: 4;
    color: ${theme.dim};
    font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    pointer-events: none;
  }
</style>
</head>
<body>
<div id="graph"></div>
<div id="name">${escapeHtml(opts.title)}</div>
<div id="banner"></div>
<script src="${DESMOS_API}"></script>
<script>
(function () {
  var state = ${embed(scaled)};
  var banner = document.getElementById('banner');

  function show(text) {
    banner.style.display = text === null ? 'none' : 'block';
    if (text !== null) banner.textContent = text;
  }

  if (typeof Desmos === 'undefined') {
    show('could not load the desmos api \\u2014 dsmx run needs a network connection the first time');
    return;
  }

  var calc = Desmos.GraphingCalculator(document.getElementById('graph'), {
    expressions: false, settingsMenu: false, keypad: false,
    zoomButtons: true, border: false,
    backgroundColor: '${theme.background}', textColor: '${theme.text}',
    showResetButtonOnGraphpaper: true
  });

  calc.setMathBounds(state.graph.viewport);

  var drawn = [];
  function draw(list) {
    // desmos keeps an expression until it is asked to drop it, so ids that went
    // away in the new compile have to be removed by hand
    var next = list.map(function (e) { return e.id; });
    drawn.forEach(function (id) {
      if (next.indexOf(id) === -1) calc.removeExpression({ id: id });
    });
    list.forEach(function (e) { calc.setExpression(toSet(e)); });
    drawn = next;
  }

  function toSet(e) {
    var out = {};
    for (var k in e) if (k !== 'slider') out[k] = e[k];
    var s = e.slider;
    if (!s) return out;
    if (s.min !== undefined || s.max !== undefined || s.step !== undefined) {
      out.sliderBounds = { min: s.min, max: s.max, step: s.step };
    }
    if (s.isPlaying !== undefined) out.playing = s.isPlaying;
    if (s.animationPeriod !== undefined) out.animationPeriod = s.animationPeriod;
    if (s.loopMode !== undefined) out.loopMode = s.loopMode;
    return out;
  }

  draw(state.expressions.list);
${opts.error === null ? '' : `  show(${embed(opts.error)});\n`}${opts.live ? LIVE : ''}
})();
</script>
</body>
</html>
`;
}

const LIVE = `
  var events = new EventSource('/events');
  events.onmessage = function (ev) {
    var msg = JSON.parse(ev.data);
    if (msg.ok) {
      show(null);
      draw(msg.state.expressions.list);
    } else {
      show(msg.errors);
    }
  };
`;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
