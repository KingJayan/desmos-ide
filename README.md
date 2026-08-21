<div align="center">
<h2><code>KingJayan/desmos-ide</code></h2>
<p>code your desmos graphs.</p>
</div>

<p align="center">
  <img src="./docs/static/favicon-scalable.svg" height="128">
</p>

<p align="center">
  <img src="https://skillicons.dev/icons?i=ts,bun" height="36">
</p>

## features

* **native DSL** — write clean math that compiles to Desmos in real time
* **file ops** — open and save native `.dsmx` files
* **live graph** — fast updates as you type via expression id diffing
* **formatter** — ⇧⌥F or format-on-save
* **export** — PNG, SVG, TeX figure, or a share link that carries the source
* **plugins** — ⌘7 for the marketplace: generators, DSL libraries, editor themes, panels and commands
* **persistence** — reopens your files exactly where you left off; autosave is opt-in
* **timeline** — declare a `time` clock for play, pause, speed, and scrub controls
* **anim presets** — shape the clock with `ease`, `pulse`, `bounce`, `wobble`, and `orbit`
* **3d projection** — map 3D scenes to 2D using `camera` and `project(x, y, z)`
* **glob search** — ⇧⌘F across recent files or a chosen folder
* **source control** — Git branches, history, and remotes for the active file's repo
* **custom editor** — configure fonts, minimap, line numbers, word wrap, and themes
* **cli** — `dsmx run file.dsmx` opens a live graph in the browser, no app needed
* **ai sidebar** — streamed chat for dsl/expr generation with OpenAI, OpenRouter, Ollama, or Copilot

## dsmx

run a `.dsmx` file in a live graph:

```bash
brew install KingJayan/dsmx/dsmx
dsmx run example/orbit.dsmx      # serves a graph with hmr
dsmx build a.dsmx -o a.json      # desmos state as json
dsmx fmt a.dsmx                  # format in place
```

macOS and Linux, req `node`, loads desmos api over network on the first time

## desktop app

```bash
brew install --cask KingJayan/dsmx/dsmx-app
```
the cask installs it ready to run — it clears the quarantine flag for you.

the app carries an ad-hoc signature, not an apple developer id one, because i don't have one. so if you download the `.app` from the releases page instead, macOS blocks it on first launch. the source is all here and the release is built by the CI workflow in this repo. to open it, either:

* open **System Settings → Privacy & Security**, and press **Open Anyway** under the blocked app, or
* remove the quarantine flag yourself:

```bash
xattr -dr com.apple.quarantine /Applications/desmos-ide.app
```

## syntax

see the [examples](example/), or the [full tour](example/demo.dsmx)

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
bun dsmx       # the cli, straight from source
bun pack:cli   # bundle + tarball the cli for a release
```

## troubleshooting/bugs [see here](https://github.com/KingJayan/desmos-ide/issues/9)

##
<div align="center">
<p>made with :) by jayan</p>
<p>licensed under Apache 2.0</p>
</div>
