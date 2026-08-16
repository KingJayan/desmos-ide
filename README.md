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
- **formatter** — ⇧⌥F, or turn on format-on-save in settings
- **persistence** — autosaves the open file, and reopens it where you left off
- **inline sliders** — drag a `slider(...)` declaration right in the editor just like Desmos
- **timeline** — declare a `time` clock and a bar under the graph gives play, pause, speed and scrub
- **animation presets** — `ease`, `pulse`, `bounce`, `wobble` and `orbit` shape the clock
- **3d projection** — `camera` and `project(x, y, z)` put a 3D scene on the 2D graph
- **source control** — branches, history and remotes for the repo the open file lives in
- **themes** — Catppuccin, GitHub Dark/Light, Monokai, VS Dark/Light
- **customizable editor** — font, font size, minimap, line numbers, word wrap
- **file operations** — open and save `.dsmx` files through native dialogs
- **AI sidebar** — chat to generate or modify expressions, streamed. Works with any
  OpenAI-compatible endpoint, OpenRouter, a local Ollama, or GitHub Copilot

## syntax

see an [example file](example/demo.dsmx)

[![Documentation](https://img.shields.io/badge/see%20full%20documentation-blue?style=for-the-badge&logo=readthedocs)](https://desmos-ide.vercel.app)

## dev

```bash
bun i
bun dev        # build the view, then launch the app
bun dev:hmr    # vite dev server + app, for renderer hot reload
bun run build  # production build → build/<channel>-<platform>/
bun test       # compiler and editor tests
bun demo       # run the compiler in the terminal, no app shell
```

## troubleshooting

| symptom | fix |
|---|---|
| window opens blank | run `bun run build:view` (serves built `dist/`) |
| AI sidebar does nothing | open the provider popover and set a model + API key |
| source control panel is empty | it follows the open file; save the file inside a repo first |
| ⇧⌘F finds nothing | it searches the recent files by default; press `folder` to search the whole folder of the open file |

or [fill out an issue](https://github.com/KingJayan/desmos-ide/issues/new) to be addressed

##
<div align="center">
<p>made with :) by jayan</p>
<p>licensed under Apache 2.0</p>
</div>
