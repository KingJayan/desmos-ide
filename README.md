<div align="center">
<h2><code>KingJayan/desmos-ide</code></h2>
<p>a minimalist Desmos IDE - integrated DSL, and live graph</p>
</div>

<p align="center">
<img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="ts" /> <img src="https://img.shields.io/badge/electrobun-F9F1E1?style=for-the-badge&logo=bun&logoColor=000000" alt="Bun" />
</p>

## features

- **DSL editor** — write math in a clean language; the compiler outputs Desmos expressions in real time
- **live graph** — Desmos graph updates as you type, diffed by expression ID to avoid flicker
- **themes** — Catppuccin (Mocha, Latte, Frappé, Macchiato), GitHub Dark/Light, Monokai, VS Dark/Light
- **customizable editor** — font, font size, minimap, line numbers, word wrap
- **file operations** — open/save `.desmos` files via native dialogs (Electron)
- **AI sidebar** — chat with Claude to generate or modify expressions (streamed)

## syntax

see an [example file](example/demo.dsmx)

[![Documentation](https://img.shields.io/badge/see%20full%20documentation-blue?style=for-the-badge&logo=readthedocs)](https://desmos-ide.vercel.app)

## dev

```bash
bun i
bun dev        # launch dev server + Electron window
bun build      # production build → out/
bun demo       # run compiler demo in terminal (no Electron)
```

## troubleshooting

| symptom | fix |
|---|---|
| Electron window doesn't open | make sure `ELECTRON_RUN_AS_NODE` is unset |
| Desmos graph blank | check network; `webSecurity: false` is required |

or [fill out an issue](https://github.com/KingJayan/desmos-ide/issues/new) to be addressed

##
<div align="center">
<p>made with :) by jayan</p>
<p>licensed under Apache 2.0</p>
</div>
