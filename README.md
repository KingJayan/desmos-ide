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
let x = 3                                      -- constant
fn f(a, b) = a + b                             -- function

point origin { (0, 0) }                        -- named point
circle ring  { center: (0,0), radius: 3 }      -- circle
line  axis   { through: (0,0), slope: 1 }      -- line

points trail = map(i in [0...60]) {            -- parametric point list
  (cos(i), sin(i))
}
```

**Supported entities:** `point`, `circle`, `line`, `points` (map)  
**Expressions:** arithmetic, `let` bindings, `fn` definitions  
**Limitations:** no implicit multiplication, no piecewise yet, no list comprehensions outside `map`

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
