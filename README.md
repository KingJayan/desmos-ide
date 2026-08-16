<div align="center">
<h2><code>KingJayan/desmos-ide</code></h2>
<p>a minimalist Desmos IDE - integrated DSL and live graph</p>
</div>

<p align="center">
<img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="ts" /> <img src="https://img.shields.io/badge/electrobun-F9F1E1?style=for-the-badge&logo=bun&logoColor=000000" alt="Bun" />
</p>

## features

* **native DSL** — write clean math that compiles to Desmos in real time
* **live graph** — fast updates as you type via expression id diffing
* **formatter** — ⇧⌥F or format-on-save
* **persistence** — reopens your files exactly where you left off; autosave is opt-in
* **timeline** — declare a `time` clock for play, pause, speed, and scrub controls
* **anim presets** — shape the clock with `ease`, `pulse`, `bounce`, `wobble`, and `orbit`
* **3d projection** — map 3D scenes to 2D using `camera` and `project(x, y, z)`
* **glob search** — ⇧⌘F across recent files or a chosen folder
* **source control** — Git branches, history, and remotes for the active file's repo
* **custom editor** — configure fonts, minimap, line numbers, word wrap, and themes
* **file ops** — open and save native `.dsmx` files
* **ai sidebar** — streamed chat for dsl/expr generation with OpenAI, OpenRouter, Ollama, or Copilot

## syntax

see an [example file](example/demo.dsmx)

[![Documentation](https://img.shields.io/badge/see%20full%20documentation-blue?style=for-the-badge&logo=readthedocs)](https://desmos-ide.vercel.app)

## dev

```bash
bun i
bun dev        # build then launch
bun dev:hmr    # vite dev server + app for renderer hmr
bun run build  # prod build → build/<channel>-<platform>/
bun test       # compiler + editor tests
bun test:e2e   # webkit over built app
bun demo       # run compiler in the terminal w/o app shell
```

## troubleshooting

| symptom | fix |
|---|---|
| window opens blank | run `bun run build:view` (serves built `dist/`) |
| AI sidebar does nothing | open the provider popover and set a model + API key |
| source control panel is empty | follows the open file; save the file inside a repo first |

or [fill out an issue](https://github.com/KingJayan/desmos-ide/issues/new) to be addressed

##
<div align="center">
<p>made with :) by jayan</p>
<p>licensed under Apache 2.0</p>
</div>
