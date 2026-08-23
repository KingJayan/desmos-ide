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

run `.dsmx` files through the cli:

```bash
brew install KingJayan/dsmx/dsmx
dsmx run example/orbit.dsmx      # serves a graph with hmr
dsmx build a.dsmx -o a.json      # desmos state as json
dsmx fmt a.dsmx                  # format in place
```

macOS and Linux, req `node`.
cli loads desmos api over network on the first time

## desktop app

### macOS

```bash
brew install --cask KingJayan/dsmx/dsmx-app
```

req macOS 14 (Sonoma) or later, apple silicon or intel. no quarentine through brew.

no apple developer id currently, because i don't have one. meaning if you download the `.app` from the releases page instead, macOS would block it on first launch. the source is all here and the release is built by CI in this repo. to open it, either:

* open **System Settings → Privacy & Security**, scroll down and press **Open Anyway** under the blocked app, or
* to remove the quarantine flag manually:

```bash
xattr -dr com.apple.quarantine /Applications/desmos-ide.app
```

### linux

x86_64 only, via tarball in [releases page](https://github.com/KingJayan/desmos-ide/releases). does not install gtk or webkit automatically, so install them first:

```bash
sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0        # debian/ubuntu
sudo dnf install gtk3 webkit2gtk4.1                    # fedora
```

then unpack the app & run the installer:

```bash
tar -xzf desmos-ide-*-linux-x86_64.tar.gz
cd desmos-ide-*-linux-x86_64
./install.sh
```

api keys are in sys keyring through `secret-tool` (`libsecret-tools`). w/o keyring ai panel still works, but says that the key is unencrypted.

**notes**: ⌘ defaults to Ctrl on linux. the window uses its native deco, and menu bar is the command palette (Ctrl+Shift+P)

### windows

x64 only. windows 11 is what this is tested on. windows 10 x64 21H2 or later should work
but is not covered by ci. **windows on ARM is not supported** — there is no arm64 build,
and the x64 one runs only under emulation, which no one has measured. no arm64 download is
published, on purpose.

winget and chocolatey are the install path to take. the installer carries no authenticode
certificate, so a browser download hits SmartScreen and some antivirus products report an
unknown publisher. a package manager avoids most of that:

```powershell
winget install KingJayan.DesmosIDE
```

```powershell
choco install dsmx-app
```

the `.exe` is on the [releases page](https://github.com/KingJayan/desmos-ide/releases) as
well. if you take it, SmartScreen shows **Windows protected your PC** — press **More info**
then **Run anyway**. the source is all here and the release is built by CI in this repo.

the app needs the **WebView2 Runtime**, which windows 11 already carries. on windows 10 get
it from [microsoft](https://developer.microsoft.com/microsoft-edge/webview2/) if the window
opens blank.

the installer does not claim the `.dsmx` file type or the `dsmx://` scheme, so
`dsmx://plugin/<id>` links from the marketplace do nothing until they are registered. winget
and chocolatey do it for you. after a manual install, run:

```powershell
powershell -ExecutionPolicy Bypass -File register.ps1
```

api keys are sealed with DPAPI under `%USERPROFILE%\.dsmx\secrets`, which ties them to the
windows account.

**notes**: ⌘ defaults to Ctrl on windows. the window uses its native deco and menu bar.
AltGr characters are left to the editor, so a chord cannot swallow `@` or `#`.

## dsl syntax

see the [examples](example/), or the [full demo](example/demo.dsmx)

[![Documentation](https://img.shields.io/badge/see%20full%20documentation-blue?style=for-the-badge&logo=readthedocs)](https://desmos-ide.vercel.app)

## dev

```bash
bun i
bun dev        # build then launch
bun dev:hmr    # vite dev server + app for renderer hmr
bun run build  # prod build → build/<channel>-<platform>/
bun test       # compiler + editor tests
bun test:e2e   # webkit over built app (chromium on windows)
bun demo       # run compiler in the terminal w/o app shell
bun dsmx       # run the cli from source
bun pack:cli   # bundle + tarball the cli for a release
```

### known upstream gaps

* electrobun has no native save panel, so macOS uses a Swift helper and every other desktop
  falls back to a folder pick — [electrobun](https://github.com/blackboardsh/electrobun/issues)
* electrobun writes no windows registry entries for a file type or a url scheme, which is why
  `register.ps1` exists — [electrobun](https://github.com/blackboardsh/electrobun/issues)
* there is no arm64 windows build, because neither electrobun nor bun ships one —
  [bun](https://github.com/oven-sh/bun/issues)

## troubleshooting/bugs [see here](https://github.com/KingJayan/desmos-ide/issues/9)

<div align="center">
<p>made with :) by jayan</p>
<p>licensed under Apache 2.0</p>
</div>
