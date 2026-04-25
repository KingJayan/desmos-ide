<div align="center">
<h2><code>KingJayan/desmos-ide</code></h2>
<p>a minimalist Desmos IDE - integrated DSL, and live graph</p>
</div>

# features

- **DSL editor** — write math in a clean language; the compiler outputs Desmos expressions in real time
- **Live graph** — Desmos graph updates as you type, diffed by expression ID to avoid flicker
- **Enhanced view** — bypass the DSL and edit raw Desmos expressions directly
- **Multiple themes** — Catppuccin (Mocha, Latte, Frappé, Macchiato), GitHub Dark/Light, Monokai, VS Dark/Light
- **Customizable editor** — font, font size, minimap, line numbers, word wrap
- **File operations** — open/save `.desmos` files via native dialogs (Electron)
- **AI sidebar** — chat with Claude to generate or modify expressions (streamed)

# DSL syntax

```
// variables and functions
x = 3
a = slider(0, 0, 10)              -- slider(initial, min, max) — add speed=n to auto-play
fn f(a, b) = a + b                -- inlined at every call site

// geometry
point p (1, 2)
circle c = circle((0, 0), 3)
line l = slope(2), intercept(1)
line l2 = 2*x + y = 4            -- standard form
segment s = (0,0) -> (1,1)
polygon tri = [(0,0),(1,0),(0,1)]

// curves and regions
curve ring (t in 0..6.28) { (cos(t), sin(t)) }   -- parametric (tuple body)
pts = (cos(t), sin(t)) for t in 0..6.28           -- inline for-comprehension
region r = y > x^2

// conditional expressions
v = x^2 where x > 0 else -x^2
z = { x > 0: x^2, x < 0: -x, else: 0 }

// text and folders
text lbl = "hello" at (1, 2)
group g as "My Folder"

// optional styling
point p2 (0, 0) as { color red pointSize 12 }
region r2 = y < x as { color blue opacity 0.3 fill }

// color accepts named, hex string, rgb(), or hsv()
curve c (t in 0..6.28) { (cos(t), sin(t)) } as { color "#e040fb" }
curve c2 (t in 0..6.28) { (cos(t), sin(t)) } as { color rgb(64, 128, 255) }

// gradient — smoothly interpolates color along a curve or list
curve ring (t in 0..6.28) { (cos(t), sin(t)) } as gradient("blue", "red")
pts = (cos(i), sin(i)) for i in 0..6.28 step 0.1 as gradient(rgb(123, 33, 22), "#33dd33")
// can also nest gradient inside the style block alongside other properties:
curve c3 (t in 0..6.28) { (cos(t), sin(t)) } as { gradient("purple", "orange") opacity 0.8 }
```

**Expressions:** full arithmetic (`+ - * / ^`), comparison operators, `where/else` conditionals, piecewise blocks, `map()` list comprehensions, `abs()`, `sqrt()`, trig, and all standard Desmos math functions.  
**Colors:** named (`red blue green orange purple black white`), hex strings (`"#ff0000"`), `rgb(r,g,b)`, or `hsv(h,s,v)`.  
**Gradients:** `as gradient(from, to)` on curves/for-comprehensions; interpolates between two colors along the parameter/loop variable. Colors can be named, hex strings, `rgb()`, or `hsv()`.

# architecture

- **Compiler** (`src/`) — pure TS pipeline: `lexer → parser → optimizer → codegen`; `compile(src)` returns `CompileSuccess | CompileFailure`
- **Renderer** (`renderer/`) — Monaco editor + Desmos CDN calculator wired in `main.ts`; `DesmosGraph` diffs expressions by ID; `EnhancedPane` for direct expr editing
- **Electron** (`electron/`) — `BrowserWindow`, native menu, `contextBridge` IPC for file ops

# usage

```bash
npm i
npm run dev        # launch dev server + Electron window
npm run build      # production build → out/
npm run demo       # run compiler demo in terminal (no Electron)
```

> **Note:** if your shell has `ELECTRON_RUN_AS_NODE=1` set (e.g. inside a Claude Code session), prefix with `unset ELECTRON_RUN_AS_NODE &&`.

# troubleshooting

| symptom | fix |
|---|---|
| Electron window doesn't open | make sure `ELECTRON_RUN_AS_NODE` is unset |
| Desmos graph blank | check network — Desmos loads from CDN; `webSecurity: false` is required |
| Settings reset on load | localStorage entry may be malformed; the app auto-repairs it to defaults |
| AI sidebar not streaming | check that `ANTHROPIC_API_KEY` is set in your environment |

<div align="center">
<p>made with :) by jayan</p>
</div>
