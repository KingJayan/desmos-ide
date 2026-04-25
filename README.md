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
// variables, sliders, aliases
x = 3
a = slider(3, 0, 10, step=0.1, speed=1, loop)   // step=, speed= kwargs; loop flag auto-plays
fn hyp(x, y) = sqrt(x^2 + y^2)                  // inlined at every call site
alias r = hyp(a, b)                              // named alias — identical to assignment

// geometry
point p (1, 2)
circle c { center (0, 0)  radius 3 }            // block form
circle c2 = circle((0, 0), 3)                   // classic form
line l = slope(2), intercept(1)
line l2 = 2*x + y = 4                           // standard form
segment s = (0,0) -> (1,1)
polygon tri = [(0,0),(1,0),(0,1)]

// generators and curves
pts = map(i -> (cos(i), sin(i)), 0..6.28 step 0.1)  // list comprehension
curve ring (t in 0..6.28) { (cos(t), sin(t)) }      // parametric
pts2 = (cos(t), sin(t)) for t in 0..6.28            // for-comprehension
region r = y > x^2

// conditionals
v = x^2 where x > 0 else -x                    // where/else
v2 = if x > 0 then x^2 else -x                 // if/then/else (identical output)
z = { x > 0: x^2, x < 0: -x, else: 0 }        // piecewise block

// domain restriction
y = x^2 domain x > 0                           // adds {x>0} filter in Desmos

// expr block — local bindings, inlined at compile time
expr {
  cx = cos(t)
  cy = sin(t)
  (2*cx, cy)
}

// debug — compile-time only, no output emitted
debug r
debug hyp(a, b)

// text and folders
text lbl = "hello" at (1, 2)
group g as "My Folder"

// built-in generators
spiral s = spiral(turns=5, spacing=0.2)
wave w = wave(freq=2, amp=1, phase=0)
grid g = grid(10, 10)

// optional styling
point p2 (0, 0) as { color red pointSize 12 }
region r2 = y < x as { color blue opacity 0.3 fill }
curve c (t in 0..6.28) { (cos(t), sin(t)) } as gradient("blue", "red")
```

**Expressions:** full arithmetic (`+ - * / ^`), comparison operators, `where/else` and `if/then/else` conditionals, piecewise blocks, `map()` generators, `abs()`, `sqrt()`, trig, and all standard Desmos math.  
**Generators:** `map(var -> expr, start..end step n)` compiles to Desmos list comprehensions — no runtime iteration.  
**Colors:** named (`red blue green orange purple black white`), hex strings (`"#ff0000"`), `rgb(r,g,b)`, or `hsv(h,s,v)`.  
**Gradients:** `as gradient(from, to)` on curves/for-comprehensions.  
**Errors:** two-phase — phase 1 is syntax errors, phase 2 is semantic (undefined functions, arity mismatches, invalid generator ranges).

[![Documentation](https://img.shields.io/badge/See%20Full%20Docs-blue?style=for-the-badge&logo=readthedocs)](https://desmos-ide.vercel.app)

# architecture

- **Compiler** (`src/`) — pure TS pipeline: `lexer → parser → semantic analysis → optimizer → codegen`; `compile(src)` returns `CompileSuccess | CompileFailure`
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
