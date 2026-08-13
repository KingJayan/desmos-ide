<div align="center">
<h2><code>KingJayan/desmos-ide</code></h2>
<p>a minimalist Desmos IDE - integrated DSL, and live graph</p>
</div>

# features

- **DSL editor** — write math in a clean language; the compiler outputs Desmos expressions in real time
- **live graph** — Desmos graph updates as you type, diffed by expression ID to avoid flicker
- **themes** — Catppuccin (Mocha, Latte, Frappé, Macchiato), GitHub Dark/Light, Monokai, VS Dark/Light
- **customizable editor** — font, font size, minimap, line numbers, word wrap
- **file operations** — open/save `.desmos` files via native dialogs (Electron)
- **AI sidebar** — chat with Claude to generate or modify expressions (streamed)

# DSL syntax

see an [example file](example/demo.dsmx)

**exprs:** full arithmetic (`+ - * / ^`), comparison operators, `where/else` and `if/then/else` conditionals, piecewise blocks, `map()` generators, `abs()`, `sqrt()`, trig, and all standard Desmos math.
**generators:** `map(var -> expr, start..end step n)` compiles to Desmos list comprehensions.
**colors:** named (`red blue green orange purple black white`), hex strings (`"#ff0000"`), `rgb(r,g,b)`, or `hsv(h,s,v)`.
**gradients:** `as gradient(from, to)` on curves/for-comprehensions.
**errors:** two-phase — phase 1 is syntax errors, phase 2 is semantic (undefined functions, arity mismatches, invalid generator ranges).

[![Documentation](https://img.shields.io/badge/See%20Full%20Docs-blue?style=for-the-badge&logo=readthedocs)](https://desmos-ide.vercel.app)

# architecture

- **compiler** (`src/`) — full typescript `lexer → parser → semantic analysis → optimizer → codegen`; `compile(src)` returns `CompileSuccess | CompileFailure`
- **renderer** (`renderer/`) — Monaco editor + Desmos CDN calculator wired in `main.ts`; `DesmosGraph` diffs expressions by ID; `EnhancedPane` for direct expr editing
- **electron** (`electron/`) — `BrowserWindow`, native menu, `contextBridge` IPC for file ops


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
<p>licensed under Apache 2.0</p>
</div>
