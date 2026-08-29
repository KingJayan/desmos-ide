import './bridge';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
(globalThis as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker() { return new EditorWorker(); },
};

import * as monaco from './monaco';
import {
  createIcons, GitBranch, Bot, Settings, RefreshCw, GitBranchPlus, Plus, List, ChevronDown,
  Box, Search, FilePlus, FolderOpen, Save, X, ListTree, CircleAlert, History, FileCode, Zap,
  Puzzle,
} from 'lucide';
import { registerLanguage, errorToMarker, LANGUAGE_ID } from '../src/monaco/language';
import CompileWorker from './compile.worker?worker';
import { CompilePipeline } from './compile-pipeline';
import { GraphOnly } from './graph-only';
import { THEMES, monacoTheme } from './themes';
import { compileToTex } from '../src/index';
import { shareUrl } from '../src/share';
import { migrateDsl, needsMigration } from '../src/compiler/migrate';
import type { CompileResult, SymbolInfo, ExprSource, OptimizeNote } from '../src/index';
import type { DesmosExpr } from '../src/compiler/codegen';
import { DesmosGraph } from './desmos';
import { Layout } from './layout';
import type { EnhancedPane } from './enhanced';
import { Transport } from './transport';
import { SettingsPanel, loadSettings, settingsFromJson, settingsToJson } from './settings';
import type { EditorSettings, UiScale } from './settings';
import type { AISidebar } from './ai-sidebar';
import type { ConfigEditor } from './config-editor';
import { Keymap, chordOf, keybindsToJson, parseKeybinds, DEFAULT_KEYBINDS } from './keybinds';
import { initPlatform, refreshPlatform } from './platform';
import { Onboarding } from './onboarding';
import { compileStatus, errorsByPhase } from './compile-status';
import { CommandPalette } from './command-palette';
import type { PaletteCommand } from './command-palette';
import { InlineSliderManager } from './inline-sliders';
import { SearchPanel } from './search-panel';
import { GraphLink } from './graph-link';
import { GitPanel } from './git-panel';
import { OptimizerPanel, groupByLine, lineHint } from './optimizer-panel';
import { typingElsewhere } from './keys';
import type { Mode } from './session';
import { WorkspaceState, baseNameOf } from './workspace-state';
import type { ConfigFile } from '../src/shared/rpc-schema';
import exampleSrc from '../example/rose.dsmx?raw';
import { loadSession, recentLabel, reportStoreFailures } from './session';
import { registerColorProvider } from './color-provider';
import { iconEl } from './icons';
import { PluginHost } from './plugins/host';
import type { HostServices } from './plugins/host';
import { PluginViews } from './plugins/views';
import { PluginContextMenu } from './plugins/menu';
import { forgetIcon } from './plugins/icon';
import { Toasts } from './toast';
import { PluginPanel } from './plugins/panel';
import { PluginPage } from './plugins/page';
import type { PluginActions } from './plugins/actions';
import type { RegistryEntry } from '../src/plugin/manifest';
import { DOM } from './modules/dom';
import { Workbench } from './modules/workbench';
import type { BottomTab } from './modules/workbench';
import { Outline, ProblemsPanel, Timeline } from './modules/panels';
import type { Problem } from './modules/panels';
import { StartPage } from './modules/start-page';
import { appCommands as buildAppCommands } from './modules/commands';
import { registerLanguageFeatures } from './modules/language-features';
import { Writeback } from './modules/writeback';

registerLanguage(monaco as Parameters<typeof registerLanguage>[0]);
registerColorProvider();
createIcons({
  icons: {
    GitBranch, Bot, Settings, RefreshCw, GitBranchPlus, Plus, List, ChevronDown,
    Box, Search, FilePlus, FolderOpen, Save, X, ListTree, CircleAlert, History, FileCode, Zap,
    Puzzle,
  },
  attrs: { 'stroke-width': '1.9' },
});

initPlatform();

const initSettings = loadSettings();
const workspaceState = new WorkspaceState({ onRecents: () => syncRecent() });

let settings: EditorSettings = initSettings;

for (const theme of THEMES) monaco.editor.defineTheme(theme.id, monacoTheme(theme.id));

document.documentElement.setAttribute('data-color-theme', initSettings.colorTheme);

function editorOptions(s: EditorSettings): monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions {
  return {
    fontSize: s.fontSize,
    fontFamily: s.codeFontFamily,
    fontLigatures: s.fontLigatures,
    lineHeight: s.lineHeight,
    lineNumbers: s.lineNumbers,
    minimap: { enabled: s.minimap },
    wordWrap: s.wordWrap,
    tabSize: s.tabSize,
    insertSpaces: s.insertSpaces,
    cursorStyle: s.cursorStyle,
    cursorBlinking: s.cursorBlinking,
    cursorSmoothCaretAnimation: s.smoothScrolling ? 'on' : 'off',
    renderWhitespace: s.renderWhitespace,
    smoothScrolling: s.smoothScrolling,
    stickyScroll: { enabled: s.stickyScroll },
    bracketPairColorization: { enabled: s.bracketPairColorization },
    guides: { indentation: s.indentGuides, bracketPairs: s.bracketPairColorization ? 'active' : false },
    codeLens: s.codeLens,
  };
}

const editor = monaco.editor.create(DOM.editorContainer, {
  value: '',
  language: LANGUAGE_ID,
  theme: initSettings.editorTheme,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 12, bottom: 12 },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'all',
  renderLineHighlightOnlyWhenFocus: true,
  roundedSelection: false,
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
  glyphMargin: false,
  ...editorOptions(initSettings),
});

const graph = new DesmosGraph(DOM.graphContainer);

const transport = new Transport(DOM.transport, {
  setPlaying: (id, playing) => graph.setClockPlaying(id, playing),
  setPeriod:  (id, period)  => graph.setClockPeriod(id, period),
  setValue:   (id, name, v) => graph.setClockValue(id, name, v),
  watch:      (name, cb)    => graph.watchClock(name, cb),
});

const toasts = new Toasts();

function markGraphStale(stale: boolean): void {
  DOM.graphIsland.classList.toggle('is-stale', stale);
  DOM.graphStale.classList.toggle('hidden', !stale);
}

let sourceMap: ExprSource[] = [];
const linkedLine = editor.createDecorationsCollection();

const graphLink = new GraphLink({
  sourceMap: () => sourceMap,
  revealLine: (line, col) => {
    editor.setPosition({ lineNumber: line, column: col });
    editor.revealLineInCenterIfOutsideViewport(line);
  },
  highlightLine: line => {
    linkedLine.set(line === null ? [] : [{
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: 'graph-linked-line' },
    }]);
  },
  selectOnGraph: id => graph.select(id),
});

graph.onSelectionChange(id => graphLink.onGraphSelected(id));

const graphOnly = new GraphOnly();

// an expression with no DSL form is not in the saved file, so it is counted where the user can see it
function noteGraphOnly(refused: string[], seen: (string | undefined)[] = []): void {
  graphOnly.record(refused, seen);
  DOM.statusGraphOnly.textContent = graphOnly.label();
  DOM.statusGraphOnly.title = graphOnly.title();
  DOM.statusGraphOnly.classList.toggle('hidden', graphOnly.count === 0);
  setEnhancedDirty(graphOnly.count > 0);
}

graph.onExpressionEdited(exprs => {
  const refused = writeback.apply(exprs);
  noteGraphOnly(refused, exprs.map(e => e.id));
});

editor.onDidChangeCursorPosition(e => {
  graphLink.onCursorMoved(e.position.lineNumber);
  DOM.statusPos.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function applyChrome(s: EditorSettings): void {
  document.documentElement.setAttribute('data-color-theme', s.colorTheme);
  document.documentElement.setAttribute('data-ui-scale', s.uiScale satisfies UiScale);
  document.documentElement.style.setProperty('--font-ui', s.uiFontFamily);
  const reduce = s.reduceMotion === 'on' || (s.reduceMotion === 'auto' && reducedMotion.matches);
  document.documentElement.toggleAttribute('data-reduce-motion', reduce);
  document.documentElement.toggleAttribute('data-hide-statusbar', !s.showStatusBar);
  document.documentElement.toggleAttribute('data-hide-tabs', !s.showTabStrip);
  document.documentElement.toggleAttribute('data-hide-breadcrumbs', !s.showBreadcrumbs);
  graph.setTheme(s.colorTheme);
  graph.setOptions({
    zoomButtons: s.graphZoomButtons,
    settingsMenu: s.graphSettingsMenu,
    keypad: s.graphKeypad,
    expressions: s.graphExpressions,
    lockViewport: s.graphLockViewport,
  });
}

reducedMotion.addEventListener('change', () => applyChrome(settings));

let enhanced: EnhancedPane | null = null;

function setEnhancedDirty(dirty: boolean): void {
  DOM.enhancedUnsavedBar.classList.toggle('hidden', !dirty);
}

let enhancedSeen: DesmosExpr[] = [];
const same = (a: DesmosExpr, b: DesmosExpr): boolean => JSON.stringify(a) === JSON.stringify(b);

// the expression list draws latex with katex, which no other view needs
async function ensureEnhancedPane(): Promise<EnhancedPane> {
  if (enhanced) return enhanced;
  const { EnhancedPane } = await import('./enhanced');
  if (enhanced) return enhanced;
  enhanced = new EnhancedPane(
    DOM.exprList,
    DOM.btnAddExpr,
    (list: DesmosExpr[]) => {
      const removed = enhancedSeen.filter(p => !list.some(e => e.id === p.id)).map(p => p.id!);
      const changed = list.filter(e => !enhancedSeen.some(p => same(p, e)));
      enhancedSeen = list.map(e => ({ ...e }));

      const refused = writeback.apply(changed, removed);
      if (refused.length) graph.update(list);
      noteGraphOnly(refused, [...changed.map(e => e.id), ...removed]);
    },
  );
  return enhanced;
}

function syncEnhanced(): void {
  void ensureEnhancedPane().then(pane => {
    if (pane.isEditing) return;
    pane.syncFromGraph(graph.currentList());
    enhancedSeen = pane.getList();
  });
}

DOM.btnExportJson.addEventListener('click', async () => {
  if (!enhanced) return;
  const json = JSON.stringify(enhanced.getList(), null, 2);
  const result = await window.electronAPI?.exportJson(json);
  if (!result) return;
  if (result.ok) {
    enhanced.clearDirty();
    graphOnly.clear();
    noteGraphOnly([]);
    setStatus('Exported', 'success');
  } else if (!result.canceled) {
    setStatus(result.message, 'error');
  }
});

//compilation pipeline
const model = editor.getModel()!;
const writeback = new Writeback({ editor, model, sourceMap: () => sourceMap });
const lastRendered = new Map<string, string>();

function unchanged(panel: string, key: string): boolean {
  if (lastRendered.get(panel) === key) return true;
  lastRendered.set(panel, key);
  return false;
}

const jumpTo = (line: number, col: number): void => {
  editor.revealLineInCenter(line);
  editor.setPosition({ lineNumber: line, column: col });
  editor.focus();
};

const outline = new Outline(jumpTo);
const problemsPanel = new ProblemsPanel(jumpTo);
const timeline = new Timeline();

function renderOutline(symbols: SymbolInfo[]): void {
  if (unchanged('outline', symbols.map(s => `${s.kind} ${s.name} ${s.line}:${s.col}`).join('\n'))) return;
  outline.render(symbols);
}

function renderProblems(problems: Problem[]): void {
  if (unchanged('problems', problems.map(p => `${p.severity} ${p.line}:${p.col} ${p.message}`).join('\n'))) return;
  problemsPanel.render(problems);
}

function noteSave(what: string): void {
  timeline.note(what);
  if (workbench.bottomOpen && workbench.bottomTab === 'timeline') void timeline.refresh();
}

let lastCompileResult: CompileResult | null = null;
const sliderManager = new InlineSliderManager(editor);

const optimizerHints = editor.createDecorationsCollection();
const optimizerPanel = new OptimizerPanel({
  list: DOM.optimizerList,
  empty: DOM.optimizerEmpty,
  count: DOM.optimizerCount,
  badge: DOM.optimizerBadge,
  jump: line => jumpTo(line, 1),
});

function renderOptimizations(notes: OptimizeNote[]): void {
  if (unchanged('optimizer', notes.map(n => `${n.kind} ${n.line}:${n.col} ${n.before}>${n.after}`).join('\n'))) return;
  optimizerPanel.render(notes);
  optimizerHints.set(settings.optimizerHints
    ? groupByLine(notes)
      .filter(g => g.line <= model.getLineCount())
      .map(g => ({
        range: new monaco.Range(g.line, model.getLineMaxColumn(g.line), g.line, model.getLineMaxColumn(g.line)),
        options: {
          after: { content: `  ${lineHint(g)}`, inlineClassName: 'optimizer-hint' },
          showIfCollapsed: true,
        },
      }))
    : []);
}

function setMarkers(owner: string, markers: monaco.editor.IMarkerData[]): void {
  const key = markers.map(m => `${m.startLineNumber}:${m.startColumn}:${m.severity}:${m.message}`).join('\n');
  if (unchanged(`markers:${owner}`, key)) return;
  monaco.editor.setModelMarkers(model, owner, markers);
}

let sliderVersion = -1;

function updateSliders(): void {
  const version = model.getVersionId();
  if (version === sliderVersion) return;
  sliderVersion = version;
  sliderManager.update(settings.inlineSliders ? model.getValue() : '');
}

function handleCompileResult(result: CompileResult): void {
  lastCompileResult = result;
  if (result.success) {
    setMarkers('desmos-dsl-syntax', []);
    setMarkers('desmos-dsl-semantic', []);
    setMarkers('desmos-dsl', result.warnings);
    graph.update(result.state.expressions.list);
    sourceMap = result.sourceMap;
    if (workbench.currentMode === 'split' || workbench.currentMode === 'enhanced') syncEnhanced();
    updateSliders();
    renderOutline(result.symbols);
    renderOptimizations(result.optimizations);
    transport.setClock(result.clock);
    markGraphStale(false);
  } else {
    const { syntax, semantic } = errorsByPhase(result.errors, errorToMarker);
    setMarkers('desmos-dsl-syntax', syntax);
    setMarkers('desmos-dsl-semantic', semantic);

    renderOptimizations([]);
    updateSliders();
    markGraphStale(true);
  }
  setMarkers('desmos-dsl-plugin', pipeline.macroErrors.map(e => ({
    startLineNumber: e.line, startColumn: e.col,
    endLineNumber: e.line,   endColumn: model.getLineMaxColumn(Math.min(e.line, model.getLineCount())),
    message: e.message,
    severity: 8,
  })));

  renderProblems([
    ...pipeline.macroErrors.map(e => ({ severity: 'error' as const, message: e.message, line: e.line, col: e.col })),
    ...(result.success
      ? result.warnings.map(w => ({
          severity: 'warning' as const,
          message: w.message,
          line: w.startLineNumber,
          col: w.startColumn,
        }))
      : result.errors.map(e => ({
          severity: 'error' as const,
          message: e.message,
          line: e.line ?? 1,
          col: e.col ?? 1,
        }))),
  ]);
  const { msg, kind } = compileStatus(result);
  setStatus(msg, kind);
}

registerLanguageFeatures(() => lastCompileResult);

const pipeline = new CompilePipeline({
  spawn: () => new CompileWorker(),
  source: () => editor.getValue(),
  expand: src => pluginHost.expand(src),
  prelude: () => pluginHost.prelude(),
  available: () => pluginHost.ids(),
  onResult: result => handleCompileResult(result),
  onStatus: (message, kind) => setStatus(message, kind),
  log: line => { if (localStorage.getItem('dsmx:perf')) console.warn(line); },
});
pipeline.start();

function runCompile(): Promise<void> {
  return pipeline.run();
}

editor.onDidChangeModelContent(() => {
  pipeline.schedule();
  refreshSavedState();
  schedulePersist();
});

window.addEventListener('unload', () => {
  pipeline.dispose();
  pluginHost.dispose();
  stopWatching();
  enhanced?.dispose();
  transport.dispose();
  gitPanel.dispose();
});

function setStatus(msg: string, kind: 'success' | 'error' | 'info' = 'info'): void {
  DOM.statusMsg.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  DOM.statusMsg.textContent = msg;
  DOM.statusMsg.className = kind;
}

// a failure the user cannot see is a failure the user cannot act on
function reportFailure(text: string): void {
  toasts.show('error', text);
  setStatus(text, 'error');
}

reportStoreFailures(text => toasts.show('warning', text));

function nativeConfirm(message: string): Promise<boolean> {
  return window.electronAPI?.confirm(message) ?? Promise.resolve(confirm(message));
}

function nativePrompt(message: string, defaultValue = ''): Promise<string | null> {
  return window.electronAPI?.prompt(message, defaultValue)
    ?? Promise.resolve(prompt(message, defaultValue));
}

const gitPanel = new GitPanel({
  setStatus,
  confirm: nativeConfirm,
  prompt: nativePrompt,
  onBranch: branch => {
    DOM.statusBranch.textContent = branch ? `⎇ ${branch}` : '';
    DOM.statusBranch.classList.toggle('hidden', !branch);
    DOM.branchWidgetLbl.textContent = branch ?? '--';
    DOM.branchWidget.classList.toggle('hidden', !branch);
  },
});

// plugins
let registryEntries: RegistryEntry[] = [];

const pluginRunnable: Record<string, () => void | Promise<void>> = {
  format: () => runEditorAction('editor.action.formatDocument'),
  compile: () => { void runCompile(); },
  save: () => cmdSave(),
  'export.png': () => cmdExportImage('png'),
  'export.svg': () => cmdExportImage('svg'),
  'export.link': () => cmdCopyShareLink(),
  'view.dsl': () => showMode('dsl'),
  'view.enhanced': () => showMode('enhanced'),
  'panel.optimizer': () => workbench.setBottomOpen(true, 'optimizer'),
  'panel.problems': () => workbench.setBottomOpen(true, 'problems'),
};

const pluginServices: HostServices = {
  notify: (kind, text) => toasts.show(kind, text, 'plugin'),
  status: text => setStatus(text, 'info'),

  editorText: () => editor.getValue(),
  editorSelection: () => {
    const selection = editor.getSelection();
    const model = editor.getModel();
    return selection && model && !selection.isEmpty() ? model.getValueInRange(selection) : '';
  },
  editorInsert: text => insertAtCursor(text),
  editorReplace: text => replaceSelection(text),
  editorSetText: text => { editor.setValue(text); editor.focus(); },

  workspace: () => workspaceState.folder(),
  runApp: async command => { await pluginRunnable[command]?.(); },
};

const pluginHost = new PluginHost(() => {
  pluginPanel.render();
  pluginPage.render();
  pluginViews.render(pluginHost.views());
  renderPluginStatusItems();
  syncEditorMenu();
  refreshPaletteCommands();
  registerPluginThemes();
}, pluginServices);

let pluginThemes: { id: string; label: string }[] = [];

function registerPluginThemes(): void {
  const defined: { id: string; label: string }[] = [];
  for (const plugin of pluginHost.enabled()) {
    const theme = plugin.manifest.theme;
    if (!theme) continue;
    const hex = (v: string) => (v.startsWith('#') ? v : `#${v}`);
    monaco.editor.defineTheme(`plugin-${plugin.manifest.id}`, {
      base: theme.dark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: Object.entries(theme.tokens).map(([token, foreground]) => ({
        token,
        foreground: foreground.replace('#', ''),
      })),
      colors: Object.fromEntries(Object.entries(theme.editor).map(([k, v]) => [k, hex(v)])),
    });
    defined.push({ id: `plugin-${plugin.manifest.id}`, label: plugin.manifest.name });
  }
  pluginThemes = defined;
  settingsPanel?.setExtraThemes(defined);
}

const pluginActions: PluginActions = {
  installed: () => pluginHost.list(),
  registry: () => registryEntries,
  loadError: id => pluginHost.loadError(id),

  install: async id => {
    setStatus(`Installing ${id}…`, 'info');
    const result = await window.electronAPI?.pluginInstall(id);
    if (!result?.ok) {
      reportFailure(result?.message ?? 'Plugins need the desktop app');
      return;
    }
    await pluginHost.refresh();
    void runCompile();
    setStatus(`Installed ${result.plugin.manifest.name}`, 'success');
  },

  uninstall: async id => {
    if (!(await nativeConfirm(`Remove the plugin '${id}'?`))) return;
    const result = await window.electronAPI?.pluginUninstall(id);
    if (!result?.ok) {
      reportFailure(result?.message ?? 'Plugins need the desktop app');
      return;
    }
    if (pluginPage.openId === id) closePluginTab();
    forgetIcon(id);
    await pluginHost.refresh();
    void runCompile();
    setStatus(`Removed ${id}`, 'success');
  },

  setEnabled: async (id, enabled) => {
    const result = await window.electronAPI?.pluginSetEnabled(id, enabled);
    if (!result?.ok) {
      reportFailure(result?.message ?? 'Plugins need the desktop app');
      return;
    }
    await pluginHost.refresh();
    void runCompile();
    setStatus(`${enabled ? 'Enabled' : 'Disabled'} ${id}`, 'info');
  },

  openPage: id => openPluginPage(id),
  openExternal: url => void window.electronAPI?.openExternal(url),
  refreshRegistry: () => refreshRegistry(),
};

const pluginPanel = new PluginPanel({
  search: DOM.pluginsSearch,
  installedList: DOM.pluginsInstalledList,
  installedEmpty: DOM.pluginsInstalledEmpty,
  marketList: DOM.pluginsMarketList,
  marketEmpty: DOM.pluginsMarketEmpty,
  refresh: DOM.pluginsRefresh,
}, pluginActions);

const pluginPage = new PluginPage(DOM.pluginPage, pluginActions);

const pluginViews = new PluginViews(DOM.pluginsViews, (plugin, view, widget, value) => {
  pluginHost.sendEvent(plugin, { view, widget, value });
});

const pluginMenu = new PluginContextMenu(pluginHost, (plugin, command) => {
  void runPluginCommand(plugin, command);
});

function renderPluginStatusItems(): void {
  DOM.statusPlugins.replaceChildren();
  for (const { plugin, item } of pluginHost.statusItems()) {
    const el = document.createElement(item.command ? 'button' : 'span');
    el.className = 'status-fact status-fact--plugin';
    el.textContent = item.text;
    el.title = item.tooltip ?? `${plugin}`;
    if (item.command) {
      const command = item.command;
      (el as HTMLButtonElement).type = 'button';
      el.addEventListener('click', () => void runPluginCommand(plugin, command));
    }
    DOM.statusPlugins.appendChild(el);
  }
}

function comboOf(e: KeyboardEvent): string | null {
  const code = e.code;
  const base = /^Key([A-Z])$/.exec(code)?.[1]?.toLowerCase()
    ?? /^Digit(\d)$/.exec(code)?.[1]
    ?? (/^F([1-9]|1[0-2])$/.test(code) ? code.toLowerCase() : null);
  if (!base) return null;

  const mods: string[] = [];
  if (e.altKey) mods.push('alt');
  if (e.shiftKey) mods.push('shift');
  if (e.ctrlKey) mods.push('ctrl');
  if (e.metaKey) mods.push('meta');
  if (!mods.includes('alt')) return null;
  return [...mods, base].join('+');
}

window.addEventListener('keydown', e => {
  const combo = comboOf(e);
  if (!combo) return;
  const owner = pluginHost.keyOwner(combo);
  if (!owner) return;
  e.preventDefault();
  void runPluginCommand(owner.plugin, owner.command);
});

let editorMenuActions: { dispose(): void }[] = [];

function syncEditorMenu(): void {
  for (const held of editorMenuActions) held.dispose();
  editorMenuActions = pluginHost.menuItems('editor').map(({ plugin, item }) =>
    editor.addAction({
      id: `plugin.${plugin}.${item.command}`,
      label: item.label,
      contextMenuGroupId: 'plugin',
      run: () => { void runPluginCommand(plugin, item.command); },
    }));
}

pluginMenu.attach('graph', DOM.graphContainer);
pluginMenu.attach('expressions', DOM.exprList);
pluginMenu.attach('plugins', DOM.pluginsContainer);

async function refreshRegistry(): Promise<void> {
  const result = await window.electronAPI?.pluginRegistry();
  if (!result) return;
  if (!result.ok) {
    reportFailure(result.message);
    return;
  }
  registryEntries = result.index.plugins;
  pluginPanel.render();
  pluginPage.render();
}

function openPluginPage(id: string): void {
  DOM.pluginTab.classList.remove('hidden');
  DOM.pluginTabLabel.textContent = pluginHost.list().find(p => p.manifest.id === id)?.manifest.name
    ?? registryEntries.find(p => p.manifest.id === id)?.manifest.name
    ?? id;
  pluginPage.show(id);
  if (workbench.isEmpty) workbench.setEmpty(false);
  workbench.setActiveTab('plugin');
}

function closePluginTab(): void {
  DOM.pluginTab.classList.add('hidden');
  pluginPage.close();
  workbench.setActiveTab('file');
}

DOM.fileTab.addEventListener('click', () => workbench.setActiveTab('file'));
DOM.pluginTab.addEventListener('click', () => { if (pluginPage.openId) workbench.setActiveTab('plugin'); });
DOM.pluginTabClose.addEventListener('click', e => { e.stopPropagation(); closePluginTab(); });

void pluginHost.refresh().then(() => runCompile());
void refreshRegistry();

// layout and panels
const layout = new Layout(
  {
    editor: DOM.divider,
    pane: DOM.paneDivider,
    toolLeft: DOM.toolLeftDivider,
    bottom: DOM.bottomDivider,
    ai: DOM.aiDivider,
  },
  {
    editorIsland: DOM.editorIsland,
    workspace: DOM.workspace,
    centerCol: DOM.centerCol,
    dslPane: DOM.dslPane,
    toolLeft: DOM.toolLeft,
    toolBottom: DOM.toolBottom,
    aiPanel: DOM.aiPanel,
  },
  () => editor.layout(),
  () => workbench.noteResize(),
);

const workbench = new Workbench({
  layout,
  relayout: () => editor.layout(),
  onMode: mode => {
    workspaceState.setMode(mode);
    if (mode === 'enhanced' || mode === 'split') {
      syncEnhanced();
      setEnhancedDirty(false);
    }
  },
  onLeftView: view => {
    if (view === 'git') void gitPanel.refreshIfStale();
    if (view === 'plugins') {
      pluginPanel.render();
      if (registryEntries.length === 0) void refreshRegistry();
    }
  },
  onAi: open => {
    if (open) { void ensureAiSidebar(); return; }
    aiSelectionListener?.dispose();
    aiSelectionListener = null;
  },
  onBottomTab: tab => { if (tab === 'timeline') void timeline.refresh(); },
});

function applyMode(m: Mode): void {
  workbench.setMode(m);
}

function showMode(m: Mode): void {
  if (workbench.isEmpty) workbench.setEmpty(false);
  applyMode(m);
  if (workbench.tab !== 'file') workbench.setActiveTab('file');
}

DOM.btnDsl.addEventListener('click', () => showMode('dsl'));
DOM.btnSplit.addEventListener('click', () => showMode('split'));
DOM.btnEnhanced.addEventListener('click', () => showMode('enhanced'));

for (const [tab, rail, button] of [
  ['problems', DOM.btnToolProblems, DOM.btnTabProblems],
  ['timeline', DOM.btnToolTimeline, DOM.btnTabTimeline],
  ['optimizer', DOM.btnToolOptimizer, DOM.btnTabOptimizer],
] as [BottomTab, HTMLButtonElement, HTMLButtonElement][]) {
  rail.addEventListener('click', () => workbench.toggleBottom(tab));
  button.addEventListener('click', () => { workbench.setBottomTab(tab); workbench.setBottomOpen(true); });
}
DOM.btnBottomClose.addEventListener('click', () => workbench.setBottomOpen(false));

DOM.btnSidebarGit.addEventListener('click', () => workbench.toggleSidebar('git'));
DOM.btnSidebarAi.addEventListener('click', () => workbench.toggleSidebar('ai'));
DOM.btnSidebarOutline.addEventListener('click', () => workbench.toggleSidebar('outline'));
DOM.btnSidebarPlugins.addEventListener('click', () => workbench.toggleSidebar('plugins'));

//file ops
function setFilename(p: string | null): Promise<unknown> {
  if (workspaceState.setPath(p)) void pluginHost.reloadWorkspace();
  const name = workspaceState.name();
  DOM.filename.textContent = name;
  DOM.tabLabel.textContent = name;
  renderBreadcrumbs(p);
  refreshSavedState();
  return Promise.resolve(window.electronAPI?.setGitContext(p)).then(() => gitPanel.refreshAll());
}

function markSaved(content: string): void {
  workspaceState.markSaved(content);
  refreshSavedState();
}

function refreshSavedState(): void {
  const unsaved = workspaceState.isUnsaved(editor.getValue());
  DOM.savedDot.classList.toggle('hidden', !unsaved);
  DOM.tabDot.classList.toggle('hidden', !unsaved);
  DOM.savedDot.title = workspaceState.path
    ? 'Unsaved changes — ⌘S to write them to the file'
    : 'This buffer has no file yet — ⌘S to choose one';
  DOM.filename.classList.toggle('filename--unsaved', unsaved);
  refreshSaveFact(unsaved);
}

function refreshSaveFact(unsaved: boolean): void {
  const on = settings.autosave && !!workspaceState.path;
  DOM.statusSave.textContent = on
    ? (unsaved ? 'autosave: saving…' : 'autosave: on')
    : (unsaved ? 'unsaved' : 'saved');
  DOM.statusSave.title = on
    ? `This file is written ${settings.autosaveDelay} ms after you stop typing`
    : 'Autosave is off — ⌘S to write the file. Turn it on in Settings';
}

function startWatching(path: string): void {
  const drop = workspaceState.watch(path);
  if (drop) void window.electronAPI?.unwatchFile(drop);
  void window.electronAPI?.watchFile(path);
}

function stopWatching(): void {
  const drop = workspaceState.unwatch();
  if (drop) void window.electronAPI?.unwatchFile(drop);
}

window.electronAPI?.onFileChanged((changedPath, content) => {
  if (changedPath !== workspaceState.path) return;
  if (content === editor.getValue()) return;
  editor.setValue(content);
  markSaved(content);
  setStatus('↻ Reloaded from disk', 'info');
  void runCompile();
});

async function enhancedDirtyGuard(): Promise<boolean> {
  if (workbench.currentMode === 'enhanced' && enhanced?.isDirty) {
    return nativeConfirm('Discard the Enhanced edits? They are not in the DSL file.');
  }
  return true;
}

function openWorkspaceView(): void {
  workbench.setEmpty(false);
  startPage.clearFolder();
  DOM.filename.textContent = workspaceState.name();
}

async function cmdNew(): Promise<void> {
  if (!(await enhancedDirtyGuard())) return;
  stopWatching();
  editor.setValue('');
  workspaceState.forgetSaved();
  void setFilename(null);
  openWorkspaceView();
  applyMode('dsl');
  setStatus('New file', 'info');
  void runCompile();
  editor.focus();
}

function cmdOpenExample(): void {
  openWorkspaceView();
  editor.setValue(exampleSrc);
  applyMode('dsl');
  void runCompile();
  editor.focus();
}

async function cmdClose(): Promise<void> {
  if (!(await enhancedDirtyGuard())) return;
  if (workspaceState.isUnsaved(editor.getValue()) && editor.getValue().trim()) {
    if (!(await nativeConfirm('Close this file? The changes are not saved.'))) return;
  }
  stopWatching();
  editor.setValue('');
  workspaceState.forgetSaved();
  void setFilename(null);
  graph.update([]);
  sourceMap = [];
  graphLink.reset();
  showStartPage();
}

function showStartPage(): void {
  startPage.render();
  workbench.setEmpty(true);
  DOM.filename.textContent = 'no file open';
  setStatus('Ready', 'info');
  startPage.focus();
}

async function cmdOpen(): Promise<void> {
  if (!(await enhancedDirtyGuard())) return;
  const result = await window.electronAPI?.openFile();
  if (!result) { reportFailure('Opening a file needs the desktop app.'); return; }
  if (!result.ok) {
    if (!result.canceled) reportFailure(result.message);
    return;
  }
  openWorkspaceView();
  editor.setValue(result.content);
  markSaved(result.content);
  void setFilename(result.path);
  startWatching(result.path);
  applyMode(workbench.currentMode === 'enhanced' ? 'dsl' : workbench.currentMode);
  void runCompile();
  persistSession();
}

async function cmdOpenFolder(): Promise<void> {
  const root = await window.electronAPI?.pickFolder();
  if (!root) return;
  const listed = await window.electronAPI?.listFolder(root);
  if (!listed) { reportFailure('Opening a folder needs the desktop app.'); return; }
  if (!listed.ok) { reportFailure(listed.message); return; }
  startPage.showFolder(listed.root, listed.entries, listed.truncated);
  workbench.setEmpty(true);
  startPage.focus();
  setStatus(`${listed.entries.length} file${listed.entries.length === 1 ? '' : 's'} in ${listed.root}`, 'info');
}

async function cmdSave(saveAs = false): Promise<void> {
  if (settings.formatOnSave) await formatDocument();
  const sent = editor.getValue();
  const result = await window.electronAPI?.saveFile(saveAs ? null : workspaceState.path, sent);
  if (!result) { reportFailure('Saving needs the desktop app.'); return; }
  if (result.ok) {
    markSaved(sent);
    void setFilename(result.path);
    startWatching(result.path);
    setStatus(`Saved to ${result.path}`, 'success');
    noteSave(result.path.split(/[\\/]/).pop()!);
    persistSession();
  } else if (!result.canceled) {
    reportFailure(result.message);
  }
}

async function cmdExportTex(): Promise<void> {
  const name = baseName();
  const result = compileToTex(editor.getValue(), {
    title: baseNameOf(workspaceState.path) ?? 'an unsaved file',
    viewport: graph.viewport() ?? undefined,
  });

  if (!result.success) {
    reportFailure(`Cannot export: ${result.errors[0]?.message ?? 'the source does not compile'}`);
    return;
  }

  const saved = await window.electronAPI?.exportTex(result.tex, `${name}.tex`);
  if (!saved) return;
  if (saved.ok) {
    setStatus(
      result.skipped.length
        ? `Exported without ${result.skipped.map(s => s.name).join(', ')} — ${result.skipped[0].reason}`
        : `Exported to ${saved.path}`,
      result.skipped.length ? 'info' : 'success',
    );
  } else if (!saved.canceled) {
    reportFailure(saved.message);
  }
}

function baseName(): string {
  return baseNameOf(workspaceState.path)?.replace(/\.dsmx$/, '') ?? 'desmos-graph';
}

async function cmdExportImage(format: 'png' | 'svg'): Promise<void> {
  const data = await graph.image(format);
  if (!data) {
    reportFailure(`The graph cannot produce ${format.toUpperCase()} here`);
    return;
  }
  const saved = await window.electronAPI?.exportImage(data, `${baseName()}.${format}`, format);
  if (!saved) return;
  if (saved.ok) setStatus(`Exported to ${saved.path}`, 'success');
  else if (!saved.canceled) reportFailure(saved.message);
}

async function buildShareUrl(): Promise<string | null> {
  if (!lastCompileResult?.success) {
    reportFailure('Cannot share: the file does not compile');
    return null;
  }
  const url = await shareUrl(editor.getValue());
  if (!url) reportFailure('Cannot share: the file is too big for a link — export the JSON instead');
  return url;
}

async function cmdCopyShareLink(): Promise<void> {
  const url = await buildShareUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Share link copied', 'success');
  } catch {
    reportFailure('Could not reach the clipboard');
  }
}

async function cmdOpenShareLink(): Promise<void> {
  const url = await buildShareUrl();
  if (!url) return;
  await window.electronAPI?.openExternal(url);
  setStatus('Opened the share link in your browser', 'success');
}

DOM.btnNew.addEventListener('click',  () => cmdNew());
DOM.btnOpen.addEventListener('click', () => cmdOpen());
DOM.btnSave.addEventListener('click', () => cmdSave());

//persistence
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function forgetRecent(path: string): void {
  workspaceState.forget(path);
}

function persistSession(): void {
  const pos = editor.getPosition();
  workspaceState.persist(editor.getValue(), pos?.lineNumber ?? 1, pos?.column ?? 1);
}

async function autosave(): Promise<void> {
  const path = workspaceState.path;
  if (!settings.autosave || !path || workspaceState.autosaving) return;
  workspaceState.autosaving = true;
  try {
    const sent = editor.getValue();
    const result = await window.electronAPI?.saveFile(path, sent);
    if (result?.ok) {
      markSaved(sent);
      noteSave(`${baseNameOf(path)} (autosave)`);
      setStatus('Autosaved', 'info');
    }
    else if (result && !result.canceled) reportFailure(result.message);
  } finally {
    workspaceState.autosaving = false;
  }
}

function schedulePersist(): void {
  if (workspaceState.restoring) return;
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistSession();
    void autosave();
  }, settings.autosaveDelay);
}

// opens a path the app already knows about, with no dialog
async function openPath(path: string, at?: { line: number; col: number }): Promise<boolean> {
  if (!(await enhancedDirtyGuard())) return false;
  const result = await window.electronAPI?.readFileAt(path);
  if (!result) { reportFailure('Opening a file needs the desktop app.'); return false; }
  if (!result.ok) {
    forgetRecent(path);
    reportFailure(result.message);
    startPage.render();
    return false;
  }
  openWorkspaceView();
  editor.setValue(result.content);
  markSaved(result.content);
  void setFilename(result.path);
  startWatching(result.path);
  if (workbench.currentMode === 'enhanced') applyMode('dsl');
  if (at) {
    editor.setPosition({ lineNumber: at.line, column: at.col });
    editor.revealLineInCenter(at.line);
  }
  editor.focus();
  void runCompile();
  return true;
}

// runs the registered formatter through monaco
function formatDocument(): Promise<void> {
  const action = editor.getAction('editor.action.formatDocument');
  return action ? Promise.resolve(action.run()).then(() => undefined) : Promise.resolve();
}

function runEditorAction(actionId: string): void {
  editor.focus();
  const action = editor.getAction(actionId);
  if (!action) return;
  void action.run();
}

function runFindWithRegex(): void {
  editor.focus();
  editor.trigger('keyboard', 'actions.findWithArgs', {
    searchString: editor.getModel()?.getValueInRange(editor.getSelection() ?? new monaco.Selection(1, 1, 1, 1)) ?? '',
    isRegex: true,
    matchWholeWord: false,
    isCaseSensitive: false,
    preserveCase: false,
  });
}

const EDITOR_ONLY = new Set(['editor.find', 'editor.replace', 'editor.find-regex']);

function inOwnDialog(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  return !!el?.closest('.config-overlay, .settings-overlay, .welcome-overlay');
}

window.addEventListener('keydown', e => {
  if (inOwnDialog(e.target)) return;
  const chord = chordOf(e);
  if (!chord) return;
  const id = keymap.commandFor(chord);
  if (!id) return;
  const command = commandIndex.get(id);
  if (!command) return;
  if (EDITOR_ONLY.has(id) && typingElsewhere(e.target)) return;
  e.preventDefault();
  void command.action();
}, true);

window.electronAPI?.onMenuNew(cmdNew);
window.electronAPI?.onMenuOpen(cmdOpen);
window.electronAPI?.onMenuSave(() => cmdSave());
window.electronAPI?.onMenuSaveAs(() => cmdSave(true));
window.electronAPI?.onMenuExportTex(() => void cmdExportTex());
window.electronAPI?.onMenuExportImage(format => void cmdExportImage(format));
window.electronAPI?.onMenuShare(() => void cmdCopyShareLink());
window.electronAPI?.onMenuOpenRecent(path => void openPath(path));
window.electronAPI?.onMenuPlugins(() => workbench.setSidebarView('plugins'));
window.electronAPI?.onOpenPluginPage(id => {
  if (registryEntries.length === 0) void refreshRegistry().then(() => openPluginPage(id));
  else openPluginPage(id);
});

window.addEventListener('focus', () => {
  void gitPanel.refreshIfStale();
});

// sidebar
let aiSidebar: AISidebar | null = null;
let aiSelectionListener: { dispose(): void } | null = null;

async function ensureAiSidebar(): Promise<AISidebar> {
  if (aiSidebar) return aiSidebar;
  const { AISidebar } = await import('./ai-sidebar');
  if (aiSidebar) return aiSidebar;
  aiSidebar = new AISidebar(
    DOM.aiContainer,
    () => {
      const selection = editor.getModel()?.getValueInRange(editor.getSelection()!) ?? '';
      return { dsl: editor.getValue(), selection };
    },
    ({ type, code }) => {
      const sel = editor.getSelection();
      if (type === 'replace') {
        if (sel && !sel.isEmpty()) {
          editor.executeEdits('ai', [{ range: sel, text: code }]);
        } else {
          editor.setValue(code);
        }
      } else {
        const pos = editor.getPosition() ?? { lineNumber: 1, column: 1 };
        editor.executeEdits('ai', [{
          range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
          text: '\n' + code,
        }]);
      }
      editor.focus();
    },
    text => toasts.show('error', text, 'ai'),
  );
  if (!aiSelectionListener) {
    aiSelectionListener = editor.onDidChangeCursorSelection(() => {
      aiSidebar?.refreshCtxPill();
    });
  }
  return aiSidebar;
}

function openAiWith(prompt: string): void {
  if (!workbench.aiOpen) workbench.setSidebarView('ai');
  void ensureAiSidebar().then(sidebar => sidebar.sendMessage(prompt));
}

// "Fix error" code lens on error lines
const fixErrCmdId = editor.addCommand(0, (_ctx: unknown, message: string, lineContent: string) => {
  openAiWith(`Fix this DSL error: ${message}\n\nLine:\n\`\`\`dsmx\n${(lineContent as string).trim()}\n\`\`\``);
});

const codeLensEmitter = new monaco.Emitter<monaco.languages.CodeLensProvider>();
monaco.languages.registerCodeLensProvider(LANGUAGE_ID, {
  onDidChange: codeLensEmitter.event,
  provideCodeLenses(model) {
    if (!settings.codeLens) return { lenses: [], dispose: () => {} };
    const markers = (['desmos-dsl-syntax', 'desmos-dsl-semantic'] as const)
      .flatMap(o => monaco.editor.getModelMarkers({ owner: o }));
    const seen = new Set<number>();
    const lenses: monaco.languages.CodeLens[] = [];
    for (const m of markers) {
      if (seen.has(m.startLineNumber)) continue;
      seen.add(m.startLineNumber);
      lenses.push({
        range: new monaco.Range(m.startLineNumber, 1, m.startLineNumber, 1),
        command: {
          id: fixErrCmdId!,
          title: '⚡ fix error',
          arguments: [m.message, model.getLineContent(m.startLineNumber)],
        },
      });
    }
    return { lenses, dispose: () => {} };
  },
  resolveCodeLens(_model, codeLens) { return codeLens; },
});

editor.onDidChangeModelDecorations(() => {
  codeLensEmitter.fire(undefined as unknown as monaco.languages.CodeLensProvider);
});

// "Optimize expression" context menu action
editor.addAction({
  id: 'ai.optimize',
  label: 'ai: optimize expression',
  contextMenuGroupId: 'ai',
  contextMenuOrder: 1,
  precondition: 'editorHasSelection',
  run(ed) {
    const sel = ed.getSelection();
    if (!sel || sel.isEmpty()) return;
    const code = ed.getModel()?.getValueInRange(sel) ?? '';
    if (!code.trim()) return;
    openAiWith(`Optimize this DSL expression:\n\`\`\`dsmx\n${code}\n\`\`\``);
  },
});

function renderBreadcrumbs(path: string | null): void {
  DOM.breadcrumbs.replaceChildren();
  const parts = path ? path.split(/[\\/]/).filter(Boolean) : ['untitled.dsmx'];

  const shown = parts.length > 4 ? ['…', ...parts.slice(-4)] : parts;
  shown.forEach((part, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '›';
      DOM.breadcrumbs.appendChild(sep);
    }
    const crumb = document.createElement('span');
    crumb.className = 'crumb';
    const last = i === shown.length - 1;
    crumb.appendChild(iconEl(last ? 'file-code' : 'folder-open'));
    crumb.appendChild(document.createTextNode(part));
    DOM.breadcrumbs.appendChild(crumb);
  });
}

DOM.searchWidget.addEventListener('click', () => palette.toggle());
DOM.projectWidget.addEventListener('click', () => palette.show('open'));
DOM.branchWidget.addEventListener('click', () => workbench.setSidebarView('git'));
DOM.tabClose.addEventListener('click', () => void cmdClose());

// settings
let settingsPanel: SettingsPanel | null = null;

function applySettings(s: EditorSettings): void {
  settings = s;
  refreshSavedState();
  gitPanel.applyAutofetch(s);
  applyChrome(s);
  monaco.editor.setTheme(s.editorTheme);
  editor.updateOptions(editorOptions(s));
  workbench.setSimple(s.simpleMode);
  sliderVersion = -1;
  updateSliders();
  lastRendered.delete('optimizer');
  if (lastCompileResult?.success) renderOptimizations(lastCompileResult.optimizations);
  codeLensEmitter.fire(undefined as unknown as monaco.languages.CodeLensProvider);
}

function ensureSettingsPanel(): SettingsPanel {
  if (settingsPanel) return settingsPanel;
  settingsPanel = new SettingsPanel(applySettings, file => void openConfigFile(file));
  settingsPanel.setExtraThemes(pluginThemes);
  return settingsPanel;
}

DOM.btnSidebarSettings.addEventListener('click', () => ensureSettingsPanel().toggle());

const palette = new CommandPalette();

const NO_BRIDGE = Promise.resolve({
  ok: false as const, errorCode: 'NO_BRIDGE', message: 'Search needs the desktop app.',
});

const searchPanel = new SearchPanel({
  paths: () => workspaceState.recents.map(f => f.path),
  folder: () => workspaceState.folder() || (workspaceState.path ? '/' : null),
  search: (paths, query, useRegex) =>
    window.electronAPI?.searchFiles(paths, query, useRegex) ?? NO_BRIDGE,
  searchFolder: (root, query, useRegex) =>
    window.electronAPI?.searchFolder(root, query, useRegex) ?? NO_BRIDGE,
  pickFolder: () => window.electronAPI?.pickFolder() ?? Promise.resolve(null),
  onOpen: hit => openPath(hit.path, { line: hit.line, col: hit.col }),
});

const keymap = new Keymap();
const commandIndex = new Map<string, PaletteCommand>();

const startPage = new StartPage({
  root: DOM.startPage,
  recents: () => workspaceState.recents.map(f => f.path),
  chord: id => keymap.labelFor(id),
  newFile: () => void cmdNew(),
  openFile: () => void cmdOpen(),
  openFolder: () => void cmdOpenFolder(),
  openPath: path => void openPath(path),
  forget: path => forgetRecent(path),
  runCommand: id => void commandIndex.get(id)?.action(),
});

const baseCommands: PaletteCommand[] = buildAppCommands({
  newFile: () => cmdNew(),
  openFile: () => cmdOpen(),
  openFolder: () => cmdOpenFolder(),
  closeFile: () => cmdClose(),
  save: saveAs => cmdSave(saveAs),
  exportTex: () => cmdExportTex(),
  exportImage: format => cmdExportImage(format),
  copyShareLink: () => cmdCopyShareLink(),
  openShareLink: () => cmdOpenShareLink(),
  openExample: () => cmdOpenExample(),
  resetGraph: () => {
    graph.update([]);
    sourceMap = [];
    graphLink.reset();
    setStatus('Graph reset', 'info');
  },
  recompile: () => { void runCompile(); setStatus('Recompiling…', 'info'); },
  editorAction: id => runEditorAction(id),
  findWithRegex: () => runFindWithRegex(),
  migrateSyntax: () => {
    const before = model.getValue();
    if (!needsMigration(before)) { setStatus('This file already uses the current grammar', 'info'); return; }
    const after = migrateDsl(before);
    editor.executeEdits('migrate', [{ range: model.getFullModelRange(), text: after }]);
    setStatus('Syntax migrated', 'info');
  },
  setMode: mode => showMode(mode),
  toggleSidebar: view => workbench.toggleSidebar(view),
  toggleLeftPanel: () => workbench.setSidebarView(workbench.leftView ? null : 'outline'),
  toggleBottom: tab => workbench.toggleBottom(tab),
  toggleBottomPanel: () => workbench.setBottomOpen(!workbench.bottomOpen),
  maximize: pane => workbench.toggleMaximized(pane),
  resetLayout: () => { workbench.resetLayout(); setStatus('Layout reset', 'info'); },
  toggleSimple: () => ensureSettingsPanel().patch({ simpleMode: !settings.simpleMode }),
  showStartPage: () => showStartPage(),
  search: () => searchPanel.show(),
  palette: () => palette.toggle(),
  settings: () => ensureSettingsPanel().toggle(),
  openConfig: file => void openConfigFile(file),
  resetKeybinds: () => cmdResetKeybinds(),
  exportSettings: () => cmdExportSettings(),
  importSettings: () => cmdImportSettings(),
  tour: () => onboarding.start(),
});

let configEditor: ConfigEditor | null = null;

// the json editor carries its own monaco grammar, so it is fetched the first time it opens
async function ensureConfigEditor(): Promise<ConfigEditor> {
  const { ConfigEditor: Editor } = await import('./config-editor');
  configEditor ??= new Editor({
    read: file => window.electronAPI?.configRead(file) ?? Promise.resolve(null),
    write: async (file, content) => {
      const ok = (await window.electronAPI?.configWrite(file, content)) ?? false;
      if (ok) applyConfig(file, content);
      return ok;
    },
    theme: () => settingsNow().editorTheme,
    fontSize: () => settingsNow().fontSize,
    fontFamily: () => settingsNow().codeFontFamily,
  });
  return configEditor;
}

async function openConfigFile(file: ConfigFile): Promise<void> {
  void (await ensureConfigEditor()).open(file);
}

const onboarding = new Onboarding({
  steps: [
    {
      target: () => DOM.editorContainer,
      title: 'write dsmx here',
      body: 'One statement per line. Every line you write compiles to a Desmos expression as you type.',
    },
    {
      target: () => DOM.graphContainer,
      title: 'the graph is the output',
      body: 'It follows the file. Click an expression and the editor moves to the line that made it.',
    },
    {
      target: () => DOM.statusbar,
      title: 'the status bar tells you the state',
      body: 'Compile result, branch, cursor position and whether the file has unsaved work.',
    },
    {
      target: () => DOM.searchWidget,
      title: 'every command is here',
      body: 'Press ⇧⌘P for the palette. Files, export, git, plugins and preferences all start there.',
    },
  ],
  openExample: () => cmdOpenExample(),
  onFinish: () => {
    ensureSettingsPanel().patch({ tourDone: true });
    if (!workspaceState.path && !editor.getValue().trim()) showStartPage();
  },
});

function settingsNow(): EditorSettings {
  return settingsPanel ? settingsPanel.current() : settings;
}

function applyConfig(file: ConfigFile, content: string): void {
  if (file === 'settings') {
    const next = settingsFromJson(content);
    if (next) ensureSettingsPanel().adopt(next);
    return;
  }
  const rules = parseKeybinds(content);
  if (!rules) return;
  keymap.apply(rules);
  refreshPaletteCommands();
}

async function loadConfigFiles(): Promise<void> {
  const settingsFile = await window.electronAPI?.configRead('settings');
  if (settingsFile) {
    if (settingsFile.content.trim().replace(/[{}\s]/g, '') === '') {
      void window.electronAPI?.configWrite('settings', settingsToJson(settingsNow()));
    } else {
      applyConfig('settings', settingsFile.content);
    }
  }
  const keybinds = await window.electronAPI?.configRead('keybinds');
  if (keybinds) applyConfig('keybinds', keybinds.content);
}

async function cmdResetKeybinds(): Promise<void> {
  const text = keybindsToJson(DEFAULT_KEYBINDS);
  const ok = await window.electronAPI?.configWrite('keybinds', text);
  keymap.apply([]);
  refreshPaletteCommands();
  if (ok) setStatus('Keybinds reset to the defaults', 'success');
  else reportFailure('Could not write keybinds.json');
}

async function cmdExportSettings(): Promise<void> {
  const result = await window.electronAPI?.exportJson(settingsToJson(settingsNow()), 'dsmx-settings.json');
  if (!result) { reportFailure('Exporting settings needs the desktop app.'); return; }
  if (!result.ok) {
    if (!result.canceled) reportFailure(result.message);
    return;
  }
  setStatus(`Settings written to ${result.path}`, 'success');
}

async function cmdImportSettings(): Promise<void> {
  const result = await window.electronAPI?.openJsonFile();
  if (!result) { reportFailure('Importing settings needs the desktop app.'); return; }
  if (!result.ok) {
    if (!result.canceled) reportFailure(result.message);
    return;
  }
  const next = settingsFromJson(result.content);
  if (!next) { reportFailure('That file is not a settings file.'); return; }
  ensureSettingsPanel().patch(next);
  setStatus('Settings imported', 'success');
}

function syncRecent(): void {
  refreshPaletteCommands();
  startPage.render();
  void window.electronAPI?.setRecentFiles(workspaceState.recents.map(f => f.path));
}

function insertAtCursor(text: string): void {
  const pos = editor.getPosition() ?? { lineNumber: 1, column: 1 };
  editor.executeEdits('plugin', [{
    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
    text,
  }]);
  editor.focus();
}

function replaceSelection(text: string): void {
  const selection = editor.getSelection();
  if (!selection || selection.isEmpty()) { insertAtCursor(text); return; }
  editor.executeEdits('plugin', [{ range: selection, text }]);
  editor.focus();
}

async function runPluginCommand(plugin: string, command: string): Promise<void> {
  const action = await pluginHost.runCommand(plugin, command);
  if (action.kind === 'status') { setStatus(action.text, 'info'); return; }
  if (action.kind === 'none') return;
  if (action.kind === 'replace') replaceSelection(action.text);
  else insertAtCursor(action.text);
}

function refreshPaletteCommands(): void {
  const paths = workspaceState.recents.map(f => f.path);
  const commands: PaletteCommand[] = [
    ...baseCommands,
    ...pluginHost.commands().map(c => ({
      id: `plugin.${c.plugin}.${c.id}`,
      label: c.label,
      description: c.description ?? `from the ${c.plugin} plugin`,
      action: () => runPluginCommand(c.plugin, c.id),
    })),
    ...workspaceState.recents.map(f => {
      const { name, hint } = recentLabel(f.path, paths);
      return {
        id: `file.recent:${f.path}`,
        label: `open recent: ${name}`,
        description: hint || f.path,
        action: () => void openPath(f.path),
      };
    }),
  ].map((command: PaletteCommand) => ({
    ...command,
    keybinding: keymap.labelFor(command.id) ?? command.keybinding,
  }));

  palette.register(commands);
  commandIndex.clear();
  for (const command of commands) commandIndex.set(command.id, command);
  syncTooltips();
  startPage.render();
}

function syncTooltips(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-chord]')) {
    const id = el.dataset['chord'] ?? '';
    el.dataset['tip'] ??= el.title;
    const label = keymap.labelFor(id);
    el.title = label ? `${el.dataset['tip']}  ${label}` : el.dataset['tip'];
  }
}

applySettings(initSettings);
workbench.restore();
refreshPaletteCommands();
syncRecent();

async function restoreSession(): Promise<void> {
  const saved = settings.restoreSession ? loadSession() : null;
  if (!saved || (!saved.path && !saved.source.trim())) {
    void setFilename(null);
    applyMode('dsl');
    if (settingsNow().tourDone) showStartPage();
    return;
  }

  workspaceState.restoring = true;
  try {
    if (saved.path) {
      const result = await window.electronAPI?.readFileAt(saved.path);
      if (result?.ok) {
        editor.setValue(result.content);
        void setFilename(result.path);
        startWatching(result.path);
      } else {
        forgetRecent(saved.path);
        editor.setValue(saved.source);
        void setFilename(null);
        reportFailure(`Could not reopen ${saved.path.split(/[\\/]/).pop()}`);
      }
    } else {
      editor.setValue(saved.source);
      void setFilename(null);
    }
    applyMode(saved.mode);
    editor.setPosition({ lineNumber: saved.line, column: saved.col });
    editor.revealLineInCenter(saved.line);
  } finally {
    workspaceState.restoring = false;
  }
  void runCompile();
}

void restoreSession();
refreshSavedState();
void gitPanel.refreshStatus();
gitPanel.applyAutofetch(initSettings);
editor.focus();

window.electronAPI?.onConfigChanged((file, content) => {
  applyConfig(file, content);
  configEditor?.reload(file, content);
});

void refreshPlatform().then(changed => {
  if (changed) refreshPaletteCommands();
});

void loadConfigFiles().then(() => {
  if (!settingsNow().tourDone) onboarding.showWelcome();
});

window.addEventListener('beforeunload', () => {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistSession();
  searchPanel.dispose();
  sliderManager.dispose();
  aiSidebar?.dispose();
  configEditor?.dispose();
  onboarding.dispose();
  layout.dispose();
});
