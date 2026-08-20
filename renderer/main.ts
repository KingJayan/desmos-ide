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
import { registerLanguage, errorToMarker, LANGUAGE_ID, KEYWORDS, BUILTIN_FNS } from '../src/monaco/language';
import { builtinSignature } from '../src/compiler/builtins';
import { formatDsl } from '../src/compiler/format';
import { findRenameEdits, isValidIdent } from '../src/compiler/rename';
import CompileWorker from './compile.worker?worker';
import type { ListDelta } from './compile.worker';
import { compileToTex } from '../src/index';
import { shareUrl } from '../src/share';
import type { CompileResult, SymbolInfo, ExprSource, OptimizeNote } from '../src/index';
import type { DesmosExpr } from '../src/compiler/codegen';
import { DesmosGraph } from './desmos';
import { Layout } from './layout';
import { EnhancedPane } from './enhanced';
import { Transport } from './transport';
import { AISidebar } from './ai-sidebar';
import { SettingsPanel, loadSettings } from './settings';
import type { ColorTheme, UiScale } from './settings';
import { compileStatus, errorsByPhase } from './compile-status';
import { CommandPalette } from './command-palette';
import type { PaletteCommand } from './command-palette';
import { InlineSliderManager } from './inline-sliders';
import { SearchPanel } from './search-panel';
import { GraphLink } from './graph-link';
import { GitPanel } from './git-panel';
import { OptimizerPanel, groupByLine, lineHint } from './optimizer-panel';
import { typingElsewhere } from './keys';
import { decompile } from '../src/compiler/decompile';
import type { Mode } from './session';
import {
  loadRecent, loadSession, pushRecent, recentLabel, removeRecent, saveRecent, saveSession,
} from './session';
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
import type { MacroError } from '../src/plugin/macro';
import type { RegistryEntry } from '../src/plugin/manifest';

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


const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const editorContainer = $('editor-container');
const graphContainer = $('graph-container');
const graphIsland = $('graph-island');
const graphStale = $('graph-stale');

function markGraphStale(stale: boolean): void {
  graphIsland.classList.toggle('is-stale', stale);
  graphStale.classList.toggle('hidden', !stale);
}
const dslPane = $('dsl-pane');
const enhancedPane = $('enhanced-pane');
const btnDsl = $<HTMLButtonElement>('btn-dsl');
const btnSplit = $<HTMLButtonElement>('btn-split');
const btnEnhanced = $<HTMLButtonElement>('btn-enhanced');
const paneDivider = $('pane-divider');
const btnNew = $<HTMLButtonElement>('btn-new');
const btnOpen = $<HTMLButtonElement>('btn-open');
const btnSave = $<HTMLButtonElement>('btn-save');
const filenameEl = $('filename');
const savedDotEl = $('saved-dot');
const statusMsg = $('status-msg');
const statusBranch = $('status-branch');
const statusSave = $('status-save');
const statusPos = $('status-pos');
const statusPlugins = $('status-plugins');
const dividerEl = $('divider');
const leftPanel = $('editor-island');
const workspace = $('upper-row');
const centerCol = $('center-col');
const tabLabel = $('tab-label');
const tabDot = $('tab-dot');
const tabClose = $<HTMLButtonElement>('tab-close');
const breadcrumbs = $('breadcrumbs');
const projectWidget = $<HTMLButtonElement>('project-widget');
const branchWidget = $<HTMLButtonElement>('branch-widget');
const branchWidgetLbl = $('branch-widget-label');
const searchWidget = $<HTMLButtonElement>('search-widget');
const toolLeft = $('tool-left');
const toolLeftDivider = $('tool-left-divider');
const toolBottom = $('tool-bottom');
const bottomDivider = $('bottom-divider');
const btnToolProblems = $<HTMLButtonElement>('btn-tool-problems');
const btnToolTimeline = $<HTMLButtonElement>('btn-tool-timeline');
const btnTabProblems = $<HTMLButtonElement>('btn-tab-problems');
const btnTabTimeline = $<HTMLButtonElement>('btn-tab-timeline');
const btnBottomClose = $<HTMLButtonElement>('btn-tool-bottom-close');
const problemsBody = $('problems-body');
const problemsList = $('problems-list');
const problemsEmpty = $('problems-empty');
const problemsBadge = $('problems-badge');
const problemsCount = $('problems-count');
const timelineBody = $('timeline-body');
const timelineList = $('timeline-list');
const timelineEmpty = $('timeline-empty');
const btnToolOptimizer = $<HTMLButtonElement>('btn-tool-optimizer');
const btnTabOptimizer = $<HTMLButtonElement>('btn-tab-optimizer');
const optimizerBody = $('optimizer-body');
const btnSidebarGit = $<HTMLButtonElement>('btn-sidebar-git');
const btnSidebarAi = $<HTMLButtonElement>('btn-sidebar-ai');
const btnSidebarOutline = $<HTMLButtonElement>('btn-sidebar-outline');
const btnSidebarSettings = $<HTMLButtonElement>('btn-sidebar-settings');
const gitContainer = $('git-sidebar-container');
const outlineContainer = $('outline-sidebar-container');
const outlineList = $('outline-list');
const outlineEmpty = $('outline-empty');
const btnSidebarPlugins = $<HTMLButtonElement>('btn-sidebar-plugins');
const pluginsContainer = $('plugins-sidebar-container');
const fileTab = $('file-tab');
const pluginTab = $('plugin-tab');
const pluginTabLabel = $('plugin-tab-label');
const pluginTabClose = $<HTMLButtonElement>('plugin-tab-close');
const pluginPageEl = $('plugin-page');
const aiPanel = $('ai-panel');
const aiDivider = $('ai-divider');
const aiContainer = $('ai-sidebar-container');


const DEFAULT_SRC = `// desmos DSL snippet

a = slider(0, 0, 6.28)

fn osc(x, k) = sin(k * x + a)

curve ripple (t in 0..6.28) { (cos(t), sin(t)) }

point origin (0, 0) as { color blue pointSize 8 }

region upper = y > osc(x, 2) as { color purple opacity 0.15 }

text lbl = "hello, desmos" at (0, 1.5)
`;

const initSettings = loadSettings();
let autosaveOn = initSettings.autosave;

monaco.editor.defineTheme('dsmx', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '5d6878' },
    { token: 'keyword',   foreground: '8cd7ff' },
    { token: 'string',    foreground: '7fe0b0' },
    { token: 'number',    foreground: 'f0c58d' },
    { token: 'type',      foreground: 'c3b0ff' },
    { token: 'function',  foreground: 'a9c7ff' },
    { token: 'variable',  foreground: 'edf2fa' },
    { token: 'operator',  foreground: '9aa5b6' },
  ],
  colors: {
    'editor.background':                '#0e1420',
    'editor.foreground':                '#edf2fa',
    'editorLineNumber.foreground':      '#2c3745',
    'editorLineNumber.activeForeground':'#9aa5b6',
    'editor.selectionBackground':       '#1e3244',
    'editor.lineHighlightBackground':   '#141b28',
    'editorCursor.foreground':          '#8cd7ff',
    'editorIndentGuide.background1':    '#1b2431',
    'editorIndentGuide.activeBackground1': '#2c3745',
    'editorWhitespace.foreground':      '#1b2431',
    'editorBracketMatch.background':    '#1e3244',
    'editorBracketMatch.border':        '#8cd7ff',
  },
});

monaco.editor.defineTheme('dsmx-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '8b95a5' },
    { token: 'keyword',   foreground: '0b7ec4' },
    { token: 'string',    foreground: '12855f' },
    { token: 'number',    foreground: 'b06a1c' },
    { token: 'type',      foreground: '6d4ad1' },
    { token: 'function',  foreground: '1c62a8' },
    { token: 'variable',  foreground: '141a24' },
    { token: 'operator',  foreground: '55606f' },
  ],
  colors: {
    'editor.background':                '#ffffff',
    'editor.foreground':                '#141a24',
    'editorLineNumber.foreground':      '#cbd2de',
    'editorLineNumber.activeForeground':'#55606f',
    'editor.selectionBackground':       '#cfe6f6',
    'editor.lineHighlightBackground':   '#f4f6fa',
    'editorCursor.foreground':          '#0b7ec4',
    'editorIndentGuide.background1':    '#e8ecf3',
    'editorWhitespace.foreground':      '#e8ecf3',
  },
});

monaco.editor.defineTheme('desmos-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '6c7086', fontStyle: 'italic' },
    { token: 'keyword',   foreground: 'cba6f7' },
    { token: 'string',    foreground: 'a6e3a1' },
    { token: 'number',    foreground: 'fab387' },
    { token: 'type',      foreground: 'f38ba8' },
    { token: 'function',  foreground: '89b4fa' },
    { token: 'variable',  foreground: 'cdd6f4' },
    { token: 'operator',  foreground: '89dceb' },
  ],
  colors: {
    'editor.background':                '#1e1e2e',
    'editor.foreground':                '#cdd6f4',
    'editorLineNumber.foreground':      '#45475a',
    'editorLineNumber.activeForeground':'#bac2de',
    'editor.selectionBackground':       '#45475a',
    'editor.lineHighlightBackground':   '#313244',
    'editorCursor.foreground':          '#b4befe',
    'editorIndentGuide.background1':    '#313244',
    'editorWhitespace.foreground':      '#313244',
  },
});

monaco.editor.defineTheme('catppuccin-latte', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '9ca0b0', fontStyle: 'italic' },
    { token: 'keyword',   foreground: '8839ef' },
    { token: 'string',    foreground: '40a02b' },
    { token: 'number',    foreground: 'fe640b' },
    { token: 'type',      foreground: 'd20f39' },
    { token: 'function',  foreground: '1e66f5' },
    { token: 'variable',  foreground: '4c4f69' },
    { token: 'operator',  foreground: '179299' },
  ],
  colors: {
    'editor.background':                '#eff1f5',
    'editor.foreground':                '#4c4f69',
    'editorLineNumber.foreground':      '#bcc0cc',
    'editorLineNumber.activeForeground':'#5c5f77',
    'editor.selectionBackground':       '#acb0be',
    'editor.lineHighlightBackground':   '#e6e9ef',
    'editorCursor.foreground':          '#7287fd',
    'editorIndentGuide.background1':    '#ccd0da',
    'editorWhitespace.foreground':      '#ccd0da',
  },
});

monaco.editor.defineTheme('catppuccin-frappe', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '737994', fontStyle: 'italic' },
    { token: 'keyword',   foreground: 'ca9ee6' },
    { token: 'string',    foreground: 'a6d189' },
    { token: 'number',    foreground: 'ef9f76' },
    { token: 'type',      foreground: 'e78284' },
    { token: 'function',  foreground: '8caaee' },
    { token: 'variable',  foreground: 'c6d0f5' },
    { token: 'operator',  foreground: '81c8be' },
  ],
  colors: {
    'editor.background':                '#303446',
    'editor.foreground':                '#c6d0f5',
    'editorLineNumber.foreground':      '#51576d',
    'editorLineNumber.activeForeground':'#b5bfe2',
    'editor.selectionBackground':       '#51576d',
    'editor.lineHighlightBackground':   '#414559',
    'editorCursor.foreground':          '#babbf1',
    'editorIndentGuide.background1':    '#414559',
    'editorWhitespace.foreground':      '#414559',
  },
});

monaco.editor.defineTheme('catppuccin-macchiato', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '6e738d', fontStyle: 'italic' },
    { token: 'keyword',   foreground: 'c6a0f6' },
    { token: 'string',    foreground: 'a6da95' },
    { token: 'number',    foreground: 'f5a97f' },
    { token: 'type',      foreground: 'ed8796' },
    { token: 'function',  foreground: '8aadf4' },
    { token: 'variable',  foreground: 'cad3f5' },
    { token: 'operator',  foreground: '8bd5ca' },
  ],
  colors: {
    'editor.background':                '#24273a',
    'editor.foreground':                '#cad3f5',
    'editorLineNumber.foreground':      '#494d64',
    'editorLineNumber.activeForeground':'#b8c0e0',
    'editor.selectionBackground':       '#494d64',
    'editor.lineHighlightBackground':   '#363a4f',
    'editorCursor.foreground':          '#b7bdf8',
    'editorIndentGuide.background1':    '#363a4f',
    'editorWhitespace.foreground':      '#363a4f',
  },
});

monaco.editor.defineTheme('github-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '8b949e', fontStyle: 'italic' },
    { token: 'keyword',   foreground: 'ff7b72' },
    { token: 'string',    foreground: 'a5d6ff' },
    { token: 'number',    foreground: '79c0ff' },
    { token: 'type',      foreground: 'ffa657' },
    { token: 'function',  foreground: 'd2a8ff' },
    { token: 'variable',  foreground: 'e6edf3' },
    { token: 'operator',  foreground: 'ff7b72' },
  ],
  colors: {
    'editor.background':           '#0d1117',
    'editor.foreground':           '#e6edf3',
    'editorLineNumber.foreground': '#6e7681',
    'editor.selectionBackground':  '#264f78',
    'editor.lineHighlightBackground': '#161b22',
    'editorCursor.foreground':     '#58a6ff',
  },
});

monaco.editor.defineTheme('github-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '6e7781', fontStyle: 'italic' },
    { token: 'keyword',   foreground: 'cf222e' },
    { token: 'string',    foreground: '0a3069' },
    { token: 'number',    foreground: '0550ae' },
    { token: 'type',      foreground: 'e36209' },
    { token: 'function',  foreground: '8250df' },
    { token: 'variable',  foreground: '24292f' },
    { token: 'operator',  foreground: 'cf222e' },
  ],
  colors: {
    'editor.background':           '#ffffff',
    'editor.foreground':           '#24292f',
    'editorLineNumber.foreground': '#8c959f',
    'editor.selectionBackground':  '#add6ff',
    'editor.lineHighlightBackground': '#f6f8fa',
    'editorCursor.foreground':     '#0969da',
  },
});

monaco.editor.defineTheme('monokai', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',   foreground: '88846f', fontStyle: 'italic' },
    { token: 'keyword',   foreground: 'f92672' },
    { token: 'string',    foreground: 'e6db74' },
    { token: 'number',    foreground: 'ae81ff' },
    { token: 'type',      foreground: '66d9e8' },
    { token: 'function',  foreground: 'a6e22e' },
    { token: 'variable',  foreground: 'f8f8f2' },
    { token: 'operator',  foreground: 'f92672' },
  ],
  colors: {
    'editor.background':           '#272822',
    'editor.foreground':           '#f8f8f2',
    'editorLineNumber.foreground': '#90908a',
    'editor.selectionBackground':  '#49483e',
    'editor.lineHighlightBackground': '#3e3d32',
    'editorCursor.foreground':     '#f8f8f0',
  },
});

document.documentElement.setAttribute('data-color-theme', initSettings.colorTheme);

const editor = monaco.editor.create(editorContainer, {
  value: DEFAULT_SRC,
  language: LANGUAGE_ID,
  theme: initSettings.editorTheme,
  fontSize: initSettings.fontSize,
  lineNumbers: initSettings.lineNumbers,
  minimap: { enabled: initSettings.minimap },
  wordWrap: initSettings.wordWrap,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  fontFamily: initSettings.codeFontFamily,
  fontLigatures: true,
  lineHeight: 1.6,
  padding: { top: 12, bottom: 12 },
  renderWhitespace: 'none',
  smoothScrolling: true,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'all',
  renderLineHighlightOnlyWhenFocus: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  roundedSelection: false,
  guides: { indentation: true, bracketPairs: 'active' },
  bracketPairColorization: { enabled: true },
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
  glyphMargin: false,
});


const graph = new DesmosGraph(graphContainer);

const transport = new Transport(document.getElementById('transport')!, {
  setPlaying: (id, playing) => graph.setClockPlaying(id, playing),
  setPeriod:  (id, period)  => graph.setClockPeriod(id, period),
  setValue:   (id, name, v) => graph.setClockValue(id, name, v),
  watch:      (name, cb)    => graph.watchClock(name, cb),
});

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

function stmtRange(at: ExprSource): monaco.Range {
  const nextLine = sourceMap
    .filter(e => e.line > at.line)
    .reduce((min, e) => Math.min(min, e.line), model.getLineCount() + 1);
  let endLine = Math.min(Math.max(at.line, nextLine - 1), model.getLineCount());

  //keep blanklines
  while (endLine > at.line && model.getLineContent(endLine).trim() === '') endLine--;
  return new monaco.Range(at.line, 1, endLine, model.getLineMaxColumn(endLine));
}

function freshName(taken: Set<string>): string {
  for (let i = 1; ; i++) {
    const name = `e${i}`;
    if (!taken.has(name)) { taken.add(name); return name; }
  }
}

function writeBackToDsl(exprs: DesmosExpr[], removedIds: string[] = []): string[] {
  const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
  const refused: string[] = [];
  const taken = new Set(sourceMap.map(e => e.id));
  const appended: string[] = [];

  for (const id of removedIds) {
    const at = sourceMap.find(e => e.id === id);
    if (at) edits.push({ range: stmtRange(at), text: '' });
  }

  for (const expr of exprs) {
    const at = expr.id ? sourceMap.find(e => e.id === expr.id) : undefined;

    if (!at) {
      if (!expr.latex?.trim()) continue;
      const statement = decompile(expr, freshName(taken));
      if (!statement) { refused.push(expr.id ?? '?'); continue; }
      appended.push(statement);
      continue;
    }

    const statement = decompile(expr, at.id);
    if (!statement) { refused.push(at.id); continue; }

    const range = stmtRange(at);
    const original = model.getValueInRange(range);
    const indent = /^\s*/.exec(original)?.[0] ?? '';
    const style = / as \{[^}]*\}\s*$/.exec(original)?.[0] ?? '';

    edits.push({ range, text: indent + statement + style.trimEnd() });
  }

  if (appended.length) {
    const last = model.getLineCount();
    const at = new monaco.Range(last, model.getLineMaxColumn(last), last, model.getLineMaxColumn(last));
    edits.push({ range: at, text: `\n${appended.join('\n')}` });
  }

  if (edits.length) editor.executeEdits('graph-writeback', edits);
  return refused;
}

graph.onExpressionEdited(exprs => {
  const refused = writeBackToDsl(exprs.filter(e => sourceMap.some(s => s.id === e.id)));
  if (refused.length) {
    setStatus(`Cannot write back as DSL: ${refused.join(', ')}`, 'error');
  }
});

editor.onDidChangeCursorPosition(e => {
  graphLink.onCursorMoved(e.position.lineNumber);
  statusPos.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
});

function applyTheme(theme: ColorTheme): void {
  document.documentElement.setAttribute('data-color-theme', theme);
  graph.setTheme(theme);
}

function applyUiFont(fontFamily: string): void {
  document.documentElement.style.setProperty('--font-ui', fontFamily);
}

function applyUiScale(scale: UiScale): void {
  document.documentElement.setAttribute('data-ui-scale', scale);
}

applyTheme(initSettings.colorTheme);
applyUiFont(initSettings.uiFontFamily);
applyUiScale(initSettings.uiScale);
monaco.editor.setTheme(initSettings.editorTheme);


let enhanced: EnhancedPane | null = null;
const enhancedUnsavedBar = document.getElementById('enhanced-unsaved-bar')!;
const btnExportJson = document.getElementById('btn-export-json') as HTMLButtonElement;

function setEnhancedDirty(dirty: boolean): void {
  enhancedUnsavedBar.classList.toggle('hidden', !dirty);
}

let enhancedSeen: DesmosExpr[] = [];
const same = (a: DesmosExpr, b: DesmosExpr): boolean => JSON.stringify(a) === JSON.stringify(b);

function ensureEnhancedPane(): EnhancedPane {
  if (enhanced) return enhanced;
  enhanced = new EnhancedPane(
    document.getElementById('expr-list')!,
    document.getElementById('btn-add-expr') as HTMLButtonElement,
    (list: DesmosExpr[]) => {
      const removed = enhancedSeen.filter(p => !list.some(e => e.id === p.id)).map(p => p.id!);
      const changed = list.filter(e => !enhancedSeen.some(p => same(p, e)));
      enhancedSeen = list.map(e => ({ ...e }));

      const refused = writeBackToDsl(changed, removed);
      if (refused.length) {
        graph.update(list);
        setStatus(`Kept on the graph only: ${refused.join(', ')}`, 'info');
      }
      setEnhancedDirty(refused.length > 0);
    },
  );
  return enhanced;
}

function syncEnhanced(): void {
  const pane = ensureEnhancedPane();
  if (pane.isEditing) return;
  pane.syncFromGraph(graph.currentList());
  enhancedSeen = pane.getList();
}

btnExportJson.addEventListener('click', async () => {
  if (!enhanced) return;
  const json = JSON.stringify(enhanced.getList(), null, 2);
  const result = await window.electronAPI?.exportJson(json);
  if (!result) return;
  if (result.ok) {
    enhanced.clearDirty();
    setEnhancedDirty(false);
    setStatus('Exported', 'success');
  } else if (!result.canceled) {
    setStatus(result.message, 'error');
  }
});

//compilation pipeline
const model = editor.getModel()!;
let compileTimer: ReturnType<typeof setTimeout> | null = null;
let compileRequestId = 0;
let workerRestarts = 0;
const MAX_WORKER_RESTARTS = 3;

type CompileWorkerResponse = {
  id: number;
  result: CompileResult;
  delta?: ListDelta;
  compileMs: number;
  cached: boolean;
};

const workerExprs = new Map<string, DesmosExpr>();
let workerOrder: string[] = [];

function applyListDelta(delta: ListDelta): DesmosExpr[] {
  for (const expr of delta.changed) workerExprs.set(expr.id, expr);
  if (delta.order) {
    workerOrder = delta.order;
    const keep = new Set(delta.order);
    for (const id of workerExprs.keys()) if (!keep.has(id)) workerExprs.delete(id);
  }
  const list: DesmosExpr[] = [];
  for (const id of workerOrder) {
    const expr = workerExprs.get(id);
    if (expr) list.push(expr);
  }
  return list;
}

const DEBOUNCE_MIN = 16;
const DEBOUNCE_MAX = 250;
const DEBOUNCE_FACTOR = 2;
let compileDebounce = 120;
let compileStartedAt = 0;

let lastOverheadMs = 0;

function noteCompileTiming(compileMs: number, cached: boolean): void {
  if (cached) return;
  const roundTrip = performance.now() - compileStartedAt;
  lastOverheadMs = Math.max(0, roundTrip - compileMs);
  compileDebounce = Math.min(DEBOUNCE_MAX, Math.max(DEBOUNCE_MIN, Math.round(roundTrip * DEBOUNCE_FACTOR)));
  if (localStorage.getItem('dsmx:perf')) {
    console.warn(
      `[compile] round-trip ${roundTrip.toFixed(1)}ms = pipeline ${compileMs.toFixed(1)}ms + overhead ${lastOverheadMs.toFixed(1)}ms → debounce ${compileDebounce}ms`,
    );
  }
}

const lastRendered = new Map<string, string>();

function unchanged(panel: string, key: string): boolean {
  if (lastRendered.get(panel) === key) return true;
  lastRendered.set(panel, key);
  return false;
}

function renderOutline(symbols: SymbolInfo[]): void {
  if (unchanged('outline', symbols.map(s => `${s.kind} ${s.name} ${s.line}:${s.col}`).join('\n'))) return;
  outlineList.innerHTML = '';
  if (symbols.length === 0) {
    outlineEmpty.classList.remove('outline-empty--hidden');
    return;
  }
  outlineEmpty.classList.add('outline-empty--hidden');
  for (const sym of symbols) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.title = `${sym.kind} ${sym.name} — line ${sym.line}`;

    const badge = document.createElement('span');
    badge.className = `outline-badge outline-badge--${sym.kind}`;
    badge.textContent = sym.kind;

    const name = document.createElement('span');
    name.className = 'outline-name';
    name.textContent = sym.name;

    const lineNum = document.createElement('span');
    lineNum.className = 'outline-line';
    lineNum.textContent = String(sym.line);

    li.appendChild(badge);
    li.appendChild(name);
    li.appendChild(lineNum);

    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', `${sym.kind} ${sym.name}, line ${sym.line}`);

    const jump = () => {
      editor.revealLineInCenter(sym.line);
      editor.setPosition({ lineNumber: sym.line, column: sym.col });
      editor.focus();
    };
    li.addEventListener('click', jump);
    li.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      jump();
    });
    outlineList.appendChild(li);
  }
}

let lastCompileResult: CompileResult | null = null;
const sliderManager = new InlineSliderManager(editor);

const optimizerHints = editor.createDecorationsCollection();
const optimizerPanel = new OptimizerPanel({
  list: $('optimizer-list'),
  empty: $('optimizer-empty'),
  count: $('optimizer-count'),
  badge: $('optimizer-badge'),
  jump: line => {
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
  },
});

function renderOptimizations(notes: OptimizeNote[]): void {
  if (unchanged('optimizer', notes.map(n => `${n.kind} ${n.line}:${n.col} ${n.before}>${n.after}`).join('\n'))) return;
  optimizerPanel.render(notes);
  optimizerHints.set(groupByLine(notes)
    .filter(g => g.line <= model.getLineCount())
    .map(g => ({
      range: new monaco.Range(g.line, model.getLineMaxColumn(g.line), g.line, model.getLineMaxColumn(g.line)),
      options: {
        after: { content: `  ${lineHint(g)}`, inlineClassName: 'optimizer-hint' },
        showIfCollapsed: true,
      },
    })));
}


function setMarkers(owner: string, markers: monaco.editor.IMarkerData[]): void {
  const key = markers.map(m => `${m.startLineNumber}:${m.startColumn}:${m.severity}:${m.message}`).join('\n');
  if (unchanged(`markers:${owner}`, key)) return;
  monaco.editor.setModelMarkers(model, owner, markers);
}

let sliderVersion = -1;

/** the sliders come from the text, not the compile, so only a real edit can move them */
function updateSliders(): void {
  const version = model.getVersionId();
  if (version === sliderVersion) return;
  sliderVersion = version;
  sliderManager.update(model.getValue());
}

function handleCompileResult(result: CompileResult): void {
  lastCompileResult = result;
  if (result.success) {
    setMarkers('desmos-dsl-syntax', []);
    setMarkers('desmos-dsl-semantic', []);
    setMarkers('desmos-dsl', result.warnings);
    graph.update(result.state.expressions.list);
    sourceMap = result.sourceMap;
    if (mode === 'split' || mode === 'enhanced') syncEnhanced();
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
  setMarkers('desmos-dsl-plugin', macroErrors.map(e => ({
    startLineNumber: e.line, startColumn: e.col,
    endLineNumber: e.line,   endColumn: model.getLineMaxColumn(Math.min(e.line, model.getLineCount())),
    message: e.message,
    severity: 8,
  })));

  renderProblems([
    ...macroErrors.map(e => ({ severity: 'error' as const, message: e.message, line: e.line, col: e.col })),
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

monaco.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, {
  provideDocumentFormattingEdits(model) {
    const formatted = formatDsl(model.getValue());
    if (formatted === model.getValue()) return [];
    return [{ range: model.getFullModelRange(), text: formatted }];
  },
});

monaco.languages.registerHoverProvider(LANGUAGE_ID, {
  provideHover(model, position) {
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);

    const sig = builtinSignature(word.word);
    if (sig) {
      return { range, contents: [{ value: `\`\`\`\n${sig}\n\`\`\``, isTrusted: true }] };
    }

    if (!lastCompileResult?.success) return null;
    const sym = lastCompileResult.symbols.find(s => s.name === word.word);
    if (!sym) return null;

    const list = lastCompileResult.state.expressions.list;
    const expr = list.find(e => e.id === sym.name) ?? list.find(e => e.id.startsWith(sym.name));

    const kindLabel = sym.kind.charAt(0).toUpperCase() + sym.kind.slice(1);
    const contents: { value: string; isTrusted: boolean }[] = [
      { value: `**${kindLabel}** \`${sym.name}\` — line ${sym.line}`, isTrusted: true },
    ];

    if (expr?.latex) {
      // strip leading "name=" binding to show just the value when it's an assignment
      const rhs = expr.latex.replace(/^[^=]+=/, '');
      contents.push({ value: `\`\`\`latex\n${rhs}\n\`\`\``, isTrusted: true });
    }

    if (sym.kind === 'fn') {
      const srcLine = model.getLineContent(sym.line).trim();
      contents.push({ value: `\`\`\`\n${srcLine}\n\`\`\``, isTrusted: true });
    }

    return { range, contents };
  },
});

monaco.languages.registerDefinitionProvider(LANGUAGE_ID, {
  provideDefinition(model, position) {
    if (!lastCompileResult?.success) return null;
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    const sym = lastCompileResult.symbols.find(s => s.name === word.word);
    if (!sym) return null;
    return {
      uri: model.uri,
      range: new monaco.Range(sym.line, sym.col, sym.line, sym.col + sym.name.length),
    };
  },
});

const RESERVED = new Set<string>([...KEYWORDS, ...BUILTIN_FNS]);

monaco.languages.registerRenameProvider(LANGUAGE_ID, {
  resolveRenameLocation(model, position) {
    const word = model.getWordAtPosition(position);
    if (!word) return { text: '', range: new monaco.Range(0, 0, 0, 0), rejectReason: 'No symbol at cursor' };
    if (RESERVED.has(word.word)) return { text: '', range: new monaco.Range(0, 0, 0, 0), rejectReason: 'Cannot rename built-in keyword' };
    if (!lastCompileResult?.success) return { text: '', range: new monaco.Range(0, 0, 0, 0), rejectReason: 'File must compile successfully to rename' };
    const sym = lastCompileResult.symbols.find(s => s.name === word.word);
    if (!sym) return { text: '', range: new monaco.Range(0, 0, 0, 0), rejectReason: 'Symbol not declared in this file' };
    return {
      range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
      text: word.word,
    };
  },
  provideRenameEdits(model, position, newName) {
    const word = model.getWordAtPosition(position);
    if (!word || RESERVED.has(word.word)) return { edits: [] };
    if (!isValidIdent(newName)) {
      return { edits: [], rejectReason: `"${newName}" is not a valid name` };
    }
    return {
      edits: findRenameEdits(model.getValue(), word.word).map(e => ({
        resource: model.uri,
        textEdit: {
          range: new monaco.Range(e.line, e.col, e.line, e.col + e.length),
          text: newName,
        },
        versionId: undefined,
      })),
    };
  },
});

let activeWorker: Worker | null = null;

function spawnWorker(): Worker {
  const w = new CompileWorker();
  w.addEventListener('message', (event: MessageEvent<CompileWorkerResponse>) => {
    const { id, result, delta, compileMs, cached } = event.data;
    if (id !== compileRequestId) return;
    if (delta && result.success) result.state.expressions.list = applyListDelta(delta);
    noteCompileTiming(compileMs, cached);
    handleCompileResult(result);
  });
  w.addEventListener('error', (e: ErrorEvent) => {
    console.error('[compile-worker] error:', e.message);
    if (workerRestarts < MAX_WORKER_RESTARTS) {
      workerRestarts++;
      setStatus(`⚠ Compiler restarting (${workerRestarts}/${MAX_WORKER_RESTARTS})…`, 'info');
      w.terminate();
      activeWorker = spawnWorker();
      void runCompile();
    } else {
      setStatus('✗ Compiler failed — reload to recover', 'error');
    }
  });
  w.addEventListener('messageerror', () => {
    console.error('[compile-worker] message decode error');
    setStatus('✗ Compiler message error', 'error');
  });
  return w;
}

activeWorker = spawnWorker();

let macroErrors: MacroError[] = [];

async function runCompile(): Promise<void> {
  if (!activeWorker) return;
  const src = editor.getValue();
  compileStartedAt = performance.now();
  compileRequestId += 1;
  const id = compileRequestId;

  // expansion is a worker round trip of its own, and a file with no invocation in it
  // has nothing to expand
  const expanded = src.includes('@')
    ? await pluginHost.expand(src)
    : { src, errors: [] as MacroError[], lineMap: undefined };
  if (id !== compileRequestId || !activeWorker) return;

  macroErrors = expanded.errors;
  activeWorker.postMessage({
    id,
    src: expanded.src,
    lineMap: expanded.lineMap,
    prelude: pluginHost.prelude(),
    available: pluginHost.ids(),
  });
}

editor.onDidChangeModelContent(() => {
  if (compileTimer !== null) clearTimeout(compileTimer);
  compileTimer = setTimeout(runCompile, compileDebounce);
  refreshSavedState();
  schedulePersist();
});

window.addEventListener('unload', () => {
  activeWorker?.terminate();
  activeWorker = null;
  pluginHost.dispose();
  stopWatching();
  enhanced?.dispose();
  transport.dispose();
  gitPanel.dispose();
});

function setStatus(msg: string, kind: 'success' | 'error' | 'info' = 'info'): void {
  statusMsg.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  statusMsg.textContent = msg;
  statusMsg.className = kind;
}

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
    statusBranch.textContent = branch ? `⎇ ${branch}` : '';
    statusBranch.classList.toggle('hidden', !branch);
    branchWidgetLbl.textContent = branch ?? '--';
    branchWidget.classList.toggle('hidden', !branch);
  },
});

// plugins
let registryEntries: RegistryEntry[] = [];

const toasts = new Toasts();

// the app commands a plugin may run, and the only ones. the host refuses anything not
// named here before it ever reaches this map
const appCommands: Record<string, () => void | Promise<void>> = {
  format: () => runEditorAction('editor.action.formatDocument'),
  compile: () => { void runCompile(); },
  save: () => cmdSave(),
  'export.png': () => cmdExportImage('png'),
  'export.svg': () => cmdExportImage('svg'),
  'export.link': () => cmdCopyShareLink(),
  'view.dsl': () => applyMode('dsl'),
  'view.enhanced': () => applyMode('enhanced'),
  'panel.optimizer': () => setBottomOpen(true, 'optimizer'),
  'panel.problems': () => setBottomOpen(true, 'problems'),
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
  // a file keeps its state with the folder it sits in, so every file beside it sees
  // the same workspace state
  workspace: () => folderOf(currentPath),
  runApp: async command => { await appCommands[command]?.(); },
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
      setStatus(result?.message ?? 'Plugins need the desktop app', 'error');
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
      setStatus(result?.message ?? 'Plugins need the desktop app', 'error');
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
      setStatus(result?.message ?? 'Plugins need the desktop app', 'error');
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
  search: $<HTMLInputElement>('plugins-search'),
  installedList: $('plugins-installed-list'),
  installedEmpty: $('plugins-installed-empty'),
  marketList: $('plugins-market-list'),
  marketEmpty: $('plugins-market-empty'),
  refresh: $<HTMLButtonElement>('plugins-refresh'),
}, pluginActions);

const pluginPage = new PluginPage(pluginPageEl, pluginActions);

const pluginViews = new PluginViews($('plugins-views'), (plugin, view, widget, value) => {
  pluginHost.sendEvent(plugin, { view, widget, value });
});

const pluginMenu = new PluginContextMenu(pluginHost, (plugin, command) => {
  void runPluginCommand(plugin, command);
});

/** what a plugin put in the status bar, redrawn whole every time anything changes */
function renderPluginStatusItems(): void {
  statusPlugins.replaceChildren();
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
    statusPlugins.appendChild(el);
  }
}

// alt changes what a key reports on macOS, so the combo is read off the physical key
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

// the editor already has monaco's menu, so a plugin item joins that one rather than
// putting a second menu over it
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

pluginMenu.attach('graph', graphContainer);
pluginMenu.attach('expressions', $('expr-list'));
pluginMenu.attach('plugins', pluginsContainer);

async function refreshRegistry(): Promise<void> {
  const result = await window.electronAPI?.pluginRegistry();
  if (!result) return;
  if (!result.ok) {
    setStatus(result.message, 'error');
    return;
  }
  registryEntries = result.index.plugins;
  pluginPanel.render();
  pluginPage.render();
}

let activeTab: 'file' | 'plugin' = 'file';

function setActiveTab(tab: 'file' | 'plugin'): void {
  activeTab = tab;
  const onFile = tab === 'file';
  fileTab.classList.toggle('tab--active', onFile);
  fileTab.setAttribute('aria-selected', String(onFile));
  pluginTab.classList.toggle('tab--active', !onFile);
  pluginTab.setAttribute('aria-selected', String(!onFile));
  pluginPageEl.classList.toggle('hidden', onFile);

  if (onFile) {
    applyMode(mode);
    return;
  }
  dslPane.classList.add('hidden');
  enhancedPane.classList.add('hidden');
  paneDivider.classList.add('hidden');
}

function openPluginPage(id: string): void {
  pluginTab.classList.remove('hidden');
  pluginTabLabel.textContent = pluginHost.list().find(p => p.manifest.id === id)?.manifest.name
    ?? registryEntries.find(p => p.manifest.id === id)?.manifest.name
    ?? id;
  pluginPage.show(id);
  setActiveTab('plugin');
}

function closePluginTab(): void {
  pluginTab.classList.add('hidden');
  pluginPage.close();
  setActiveTab('file');
}

fileTab.addEventListener('click', () => setActiveTab('file'));
pluginTab.addEventListener('click', () => { if (pluginPage.openId) setActiveTab('plugin'); });
pluginTabClose.addEventListener('click', e => { e.stopPropagation(); closePluginTab(); });

void pluginHost.refresh().then(() => runCompile());
void refreshRegistry();

void runCompile();

//mode switching
let mode: Mode = 'dsl';

function applyMode(m: Mode): void {
  mode = m;
  btnDsl.classList.toggle('active', m === 'dsl');
  btnSplit.classList.toggle('active', m === 'split');
  btnEnhanced.classList.toggle('active', m === 'enhanced');

  if (activeTab === 'plugin') return;

  const showDsl      = m === 'dsl' || m === 'split';
  const showEnhanced = m === 'enhanced' || m === 'split';
  const showDivider  = m === 'split';

  dslPane.classList.toggle('hidden', !showDsl);
  dslPane.classList.toggle('split', m === 'split');
  enhancedPane.classList.toggle('hidden', !showEnhanced);
  enhancedPane.classList.toggle('split', m === 'split');
  paneDivider.classList.toggle('hidden', !showDivider);
  if (m !== 'split') { dslPane.style.height = ''; dslPane.style.flex = ''; }

  if (showEnhanced) {
    syncEnhanced();
    setEnhancedDirty(false);
  }
  if (showDsl) editor.layout();
}

function showMode(m: Mode): void {
  applyMode(m);
  if (activeTab !== 'file') setActiveTab('file');
}

btnDsl.addEventListener('click', () => showMode('dsl'));
btnSplit.addEventListener('click', () => showMode('split'));
btnEnhanced.addEventListener('click', () => showMode('enhanced'));

//file ops
let currentPath: string | null = null;
let watchedPath: string | null = null;

function folderOf(p: string | null): string | null {
  return p ? p.replace(/[\\/][^\\/]*$/, '') : null;
}

function setFilename(p: string | null): Promise<unknown> {
  // a plugin keeps workspace state per folder, so moving to another one hands every
  // plugin the state that belongs there
  const moved = folderOf(p) !== folderOf(currentPath);
  currentPath = p;
  if (moved) void pluginHost.reloadWorkspace();
  if (p) rememberRecent(p);
  const name = p ? p.split(/[\\/]/).pop()! : 'untitled.dsmx';
  filenameEl.textContent = name;
  tabLabel.textContent = name;
  renderBreadcrumbs(p);
  refreshSavedState();
  return Promise.resolve(window.electronAPI?.setGitContext(p)).then(() => gitPanel.refreshAll());
}

let savedSource: string | null = null;

function markSaved(content: string): void {
  savedSource = content;
  refreshSavedState();
}

function refreshSavedState(): void {
  const unsaved = savedSource === null || editor.getValue() !== savedSource;
  savedDotEl.classList.toggle('hidden', !unsaved);
  tabDot.classList.toggle('hidden', !unsaved);
  savedDotEl.title = currentPath
    ? 'Unsaved changes — ⌘S to write them to the file'
    : 'This buffer has no file yet — ⌘S to choose one';
  filenameEl.classList.toggle('filename--unsaved', unsaved);
  refreshSaveFact(unsaved);
}

function refreshSaveFact(unsaved: boolean): void {
  const on = autosaveOn && !!currentPath;
  statusSave.textContent = on
    ? (unsaved ? 'autosave: saving…' : 'autosave: on')
    : (unsaved ? 'unsaved' : 'saved');
  statusSave.title = on
    ? 'This file is written 1.2 s after you stop typing'
    : 'Autosave is off — ⌘S to write the file. Turn it on in Settings';
}

function startWatching(path: string): void {
  if (watchedPath && watchedPath !== path) {
    void window.electronAPI?.unwatchFile(watchedPath);
  }
  watchedPath = path;
  void window.electronAPI?.watchFile(path);
}

function stopWatching(): void {
  if (watchedPath) {
    void window.electronAPI?.unwatchFile(watchedPath);
    watchedPath = null;
  }
}

window.electronAPI?.onFileChanged((changedPath, content) => {
  if (changedPath !== currentPath) return;
  if (content === editor.getValue()) return;
  editor.setValue(content);
  markSaved(content);
  setStatus('↻ Reloaded from disk', 'info');
  void runCompile();
});

async function enhancedDirtyGuard(): Promise<boolean> {
  if (mode === 'enhanced' && enhanced?.isDirty) {
    return nativeConfirm('Discard the Enhanced edits? They are not in the DSL file.');
  }
  return true;
}

async function cmdNew(): Promise<void> {
  if (!(await enhancedDirtyGuard())) return;
  stopWatching();
  editor.setValue(DEFAULT_SRC);
  savedSource = null;
  void setFilename(null);
  setStatus('New file', 'info');
  applyMode('dsl');
  void runCompile();
}

async function cmdOpen(): Promise<void> {
  if (!(await enhancedDirtyGuard())) return;
  const result = await window.electronAPI?.openFile();
  if (!result) return;
  if (!result.ok) {
    if (!result.canceled) setStatus(result.message, 'error');
    return;
  }
  editor.setValue(result.content);
  markSaved(result.content);
  void setFilename(result.path);
  startWatching(result.path);
  applyMode(mode === 'enhanced' ? 'dsl' : mode);
  void runCompile();
  persistSession();
}

async function cmdSave(saveAs = false): Promise<void> {
  if (formatOnSave) await formatDocument();
  const sent = editor.getValue();
  const result = await window.electronAPI?.saveFile(saveAs ? null : currentPath, sent);
  if (!result) return;
  if (result.ok) {
    markSaved(sent);
    void setFilename(result.path);
    startWatching(result.path);
    setStatus(`Saved to ${result.path}`, 'success');
    noteSave(result.path.split(/[\\/]/).pop()!);
    persistSession();
  } else if (!result.canceled) {
    setStatus(result.message, 'error');
  }
}

async function cmdExportTex(): Promise<void> {
  const name = baseName();
  const result = compileToTex(editor.getValue(), {
    title: currentPath?.replace(/^.*\//, '') ?? 'an unsaved file',
    viewport: graph.viewport() ?? undefined,
  });

  if (!result.success) {
    setStatus(`Cannot export: ${result.errors[0]?.message ?? 'the source does not compile'}`, 'error');
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
    setStatus(saved.message, 'error');
  }
}

function baseName(): string {
  return currentPath?.replace(/^.*\//, '').replace(/\.dsmx$/, '') ?? 'desmos-graph';
}

async function cmdExportImage(format: 'png' | 'svg'): Promise<void> {
  const data = await graph.image(format);
  if (!data) {
    setStatus(`The graph cannot produce ${format.toUpperCase()} here`, 'error');
    return;
  }
  const saved = await window.electronAPI?.exportImage(data, `${baseName()}.${format}`, format);
  if (!saved) return;
  if (saved.ok) setStatus(`Exported to ${saved.path}`, 'success');
  else if (!saved.canceled) setStatus(saved.message, 'error');
}

async function buildShareUrl(): Promise<string | null> {
  if (!lastCompileResult?.success) {
    setStatus('Cannot share: the file does not compile', 'error');
    return null;
  }
  const url = await shareUrl(editor.getValue());
  if (!url) setStatus('Cannot share: the file is too big for a link — export the JSON instead', 'error');
  return url;
}

async function cmdCopyShareLink(): Promise<void> {
  const url = await buildShareUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Share link copied', 'success');
  } catch {
    setStatus('Could not reach the clipboard', 'error');
  }
}

async function cmdOpenShareLink(): Promise<void> {
  const url = await buildShareUrl();
  if (!url) return;
  await window.electronAPI?.openExternal(url);
  setStatus('Opened the share link in your browser', 'success');
}

btnNew.addEventListener('click',  () => cmdNew());
btnOpen.addEventListener('click', () => cmdOpen());
btnSave.addEventListener('click', () => cmdSave());

//persistence
const AUTOSAVE_DELAY = 1200;
let recentFiles = loadRecent();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let autosaving = false;
let restoring = false;

function rememberRecent(path: string): void {
  recentFiles = pushRecent(recentFiles, path);
  saveRecent(recentFiles);
  syncRecent();
}

function forgetRecent(path: string): void {
  recentFiles = removeRecent(recentFiles, path);
  saveRecent(recentFiles);
  syncRecent();
}

function persistSession(): void {
  const pos = editor.getPosition();
  saveSession({
    path: currentPath,
    source: editor.getValue(),
    mode,
    line: pos?.lineNumber ?? 1,
    col: pos?.column ?? 1,
  });
}

async function autosave(): Promise<void> {
  if (!autosaveOn || !currentPath || autosaving) return;
  autosaving = true;
  try {
    const sent = editor.getValue();
    const result = await window.electronAPI?.saveFile(currentPath, sent);
    if (result?.ok) {
      markSaved(sent);
      noteSave(`${currentPath.split(/[\\/]/).pop()} (autosave)`);
      setStatus('Autosaved', 'info');
    }
    else if (result && !result.canceled) setStatus(result.message, 'error');
  } finally {
    autosaving = false;
  }
}

function schedulePersist(): void {
  if (restoring) return;
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistSession();
    void autosave();
  }, AUTOSAVE_DELAY);
}

// opens a path the app already knows about, with no dialog
async function openPath(path: string, at?: { line: number; col: number }): Promise<boolean> {
  if (!(await enhancedDirtyGuard())) return false;
  const result = await window.electronAPI?.readFileAt(path);
  if (!result) return false;
  if (!result.ok) {
    forgetRecent(path);
    setStatus(result.message, 'error');
    return false;
  }
  editor.setValue(result.content);
  markSaved(result.content);
  void setFilename(result.path);
  startWatching(result.path);
  if (mode === 'enhanced') applyMode('dsl');
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

window.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;

  const k = e.key.toLowerCase();
  const elsewhere = typingElsewhere(e.target);

  if (!e.shiftKey && !e.altKey && k === 'n') {
    e.preventDefault();
    void cmdNew();
    return;
  }

  if (!e.shiftKey && !e.altKey && k === 'o') {
    e.preventDefault();
    void cmdOpen();
    return;
  }

  if (!e.shiftKey && !e.altKey && k === 's') {
    e.preventDefault();
    void cmdSave();
    return;
  }

  if (!e.shiftKey && !e.altKey && k === 'f') {
    if (elsewhere) return;
    e.preventDefault();
    runEditorAction('actions.find');
    return;
  }

  if (!e.altKey && k === 'h') {
    if (elsewhere) return;
    e.preventDefault();
    runEditorAction('editor.action.startFindReplaceAction');
    return;
  }

  if (e.shiftKey && !e.altKey && k === 'f') {
    e.preventDefault();
    searchPanel.toggle();
    return;
  }

  if (e.altKey && k === 'r') {
    if (elsewhere) return;
    e.preventDefault();
    runFindWithRegex();
    return;
  }

  if (e.shiftKey && !e.altKey && k === 'p') {
    e.preventDefault();
    palette.toggle();
    return;
  }

  // ⌘1..⌘7 toggle the tool windows, the way the rail tooltips say
  if (!e.shiftKey && !e.altKey && TOOL_KEYS[k]) {
    e.preventDefault();
    TOOL_KEYS[k]();
  }
});

const TOOL_KEYS: Record<string, () => void> = {
  '1': () => setSidebarView(leftView === 'git' ? null : 'git'),
  '2': () => setSidebarView(leftView === 'outline' ? null : 'outline'),
  '3': () => toggleBottom('problems'),
  '4': () => toggleBottom('timeline'),
  '5': () => setSidebarView(sidebarView === 'ai' ? null : 'ai'),
  '6': () => toggleBottom('optimizer'),
  '7': () => setSidebarView(leftView === 'plugins' ? null : 'plugins'),
};

window.addEventListener('keydown', e => {
  if (e.key === 'F1') {
    e.preventDefault();
    palette.toggle();
  }
}, true);

window.electronAPI?.onMenuNew(cmdNew);
window.electronAPI?.onMenuOpen(cmdOpen);
window.electronAPI?.onMenuSave(() => cmdSave());
window.electronAPI?.onMenuSaveAs(() => cmdSave(true));
window.electronAPI?.onMenuExportTex(() => void cmdExportTex());
window.electronAPI?.onMenuExportImage(format => void cmdExportImage(format));
window.electronAPI?.onMenuShare(() => void cmdCopyShareLink());
window.electronAPI?.onMenuOpenRecent(path => void openPath(path));
window.electronAPI?.onMenuPlugins(() => setSidebarView('plugins'));
window.electronAPI?.onOpenPluginPage(id => {
  if (registryEntries.length === 0) void refreshRegistry().then(() => openPluginPage(id));
  else openPluginPage(id);
});

window.addEventListener('focus', () => {
  void gitPanel.refreshIfStale();
});

const layout = new Layout(
  {
    editor: dividerEl,
    pane: paneDivider,
    toolLeft: toolLeftDivider,
    bottom: bottomDivider,
    ai: aiDivider,
  },
  {
    editorIsland: leftPanel,
    workspace,
    centerCol,
    dslPane,
    toolLeft,
    toolBottom,
    aiPanel,
  },
  () => editor.layout(),
);

// sidebar
type SidebarView = 'git' | 'ai' | 'outline' | 'plugins' | null;
let sidebarView: SidebarView = null;
let aiSidebar: AISidebar | null = null;
let aiSelectionListener: { dispose(): void } | null = null;

function ensureAiSidebar(): AISidebar {
  if (aiSidebar) return aiSidebar;
  aiSidebar = new AISidebar(
    aiContainer,
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
  );
  if (!aiSelectionListener) {
    aiSelectionListener = editor.onDidChangeCursorSelection(() => {
      aiSidebar?.refreshCtxPill();
    });
  }
  return aiSidebar;
}

let leftView: 'git' | 'outline' | 'plugins' | null = null;

function setSidebarView(next: SidebarView): void {
  if (next === 'git' || next === 'outline' || next === 'plugins') leftView = next;
  else if (next === null) leftView = null;
  sidebarView = next;

  const leftOpen = leftView !== null;
  toolLeft.classList.toggle('hidden', !leftOpen);
  toolLeftDivider.classList.toggle('hidden', !leftOpen);
  gitContainer.classList.toggle('hidden', leftView !== 'git');
  outlineContainer.classList.toggle('hidden', leftView !== 'outline');
  pluginsContainer.classList.toggle('hidden', leftView !== 'plugins');

  const aiOpen = next === 'ai';
  aiPanel.classList.toggle('hidden', !aiOpen);
  aiDivider.classList.toggle('hidden', !aiOpen);
  aiContainer.classList.toggle('hidden', !aiOpen);

  btnSidebarGit.classList.toggle('active', leftView === 'git');
  btnSidebarOutline.classList.toggle('active', leftView === 'outline');
  btnSidebarPlugins.classList.toggle('active', leftView === 'plugins');
  btnSidebarAi.classList.toggle('active', aiOpen);

  if (next === 'ai') {
    ensureAiSidebar();
  } else if (aiSelectionListener) {
    aiSelectionListener.dispose();
    aiSelectionListener = null;
  }
  if (next === 'git') {
    void gitPanel.refreshIfStale();
  }
  if (next === 'plugins') {
    pluginPanel.render();
    if (registryEntries.length === 0) void refreshRegistry();
  }

  editor.layout();
}

function openAiWith(prompt: string): void {
  if (sidebarView !== 'ai') setSidebarView('ai');
  ensureAiSidebar().sendMessage(prompt);
}

// "Fix error" code lens on error lines
const fixErrCmdId = editor.addCommand(0, (_ctx: unknown, message: string, lineContent: string) => {
  openAiWith(`Fix this DSL error: ${message}\n\nLine:\n\`\`\`dsmx\n${(lineContent as string).trim()}\n\`\`\``);
});

const codeLensEmitter = new monaco.Emitter<monaco.languages.CodeLensProvider>();
monaco.languages.registerCodeLensProvider(LANGUAGE_ID, {
  onDidChange: codeLensEmitter.event,
  provideCodeLenses(model) {
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

btnSidebarGit.addEventListener('click', () => {
  setSidebarView(sidebarView === 'git' ? null : 'git');
});

btnSidebarAi.addEventListener('click', () => {
  setSidebarView(sidebarView === 'ai' ? null : 'ai');
});

btnSidebarOutline.addEventListener('click', () => {
  setSidebarView(leftView === 'outline' ? null : 'outline');
});

btnSidebarPlugins.addEventListener('click', () => {
  setSidebarView(leftView === 'plugins' ? null : 'plugins');
});


function renderBreadcrumbs(path: string | null): void {
  breadcrumbs.replaceChildren();
  const parts = path ? path.split(/[\\/]/).filter(Boolean) : ['untitled.dsmx'];

  const shown = parts.length > 4 ? ['…', ...parts.slice(-4)] : parts;
  shown.forEach((part, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '›';
      breadcrumbs.appendChild(sep);
    }
    const crumb = document.createElement('span');
    crumb.className = 'crumb';
    const last = i === shown.length - 1;
    crumb.appendChild(iconEl(last ? 'file-code' : 'folder-open'));
    crumb.appendChild(document.createTextNode(part));
    breadcrumbs.appendChild(crumb);
  });
}

searchWidget.addEventListener('click', () => palette.toggle());
projectWidget.addEventListener('click', () => palette.show('open'));
branchWidget.addEventListener('click', () => setSidebarView('git'));
tabClose.addEventListener('click', () => void cmdNew());


type BottomTab = 'problems' | 'timeline' | 'optimizer';
let bottomTab: BottomTab = 'problems';
let bottomOpen = false;

const BOTTOM_TABS: Record<BottomTab, { body: HTMLElement; tab: HTMLButtonElement; rail: HTMLButtonElement }> = {
  problems:  { body: problemsBody,  tab: btnTabProblems,  rail: btnToolProblems },
  timeline:  { body: timelineBody,  tab: btnTabTimeline,  rail: btnToolTimeline },
  optimizer: { body: optimizerBody, tab: btnTabOptimizer, rail: btnToolOptimizer },
};

function setBottomTab(tab: BottomTab): void {
  bottomTab = tab;
  for (const [name, els] of Object.entries(BOTTOM_TABS) as [BottomTab, typeof BOTTOM_TABS[BottomTab]][]) {
    const on = name === tab;
    els.body.classList.toggle('hidden', !on);
    els.tab.classList.toggle('tool-tab--active', on);
    els.tab.setAttribute('aria-selected', String(on));
  }
  if (tab === 'timeline') void refreshTimeline();
}

function syncRailActive(): void {
  for (const [name, els] of Object.entries(BOTTOM_TABS) as [BottomTab, typeof BOTTOM_TABS[BottomTab]][]) {
    els.rail.classList.toggle('active', bottomOpen && bottomTab === name);
  }
}

function setBottomOpen(open: boolean, tab?: BottomTab): void {
  bottomOpen = open;
  toolBottom.classList.toggle('hidden', !open);
  bottomDivider.classList.toggle('hidden', !open);
  if (open && tab) setBottomTab(tab);
  syncRailActive();
  editor.layout();
}

function toggleBottom(tab: BottomTab): void {
  if (bottomOpen && bottomTab === tab) setBottomOpen(false);
  else setBottomOpen(true, tab);
  syncRailActive();
}

for (const [name, els] of Object.entries(BOTTOM_TABS) as [BottomTab, typeof BOTTOM_TABS[BottomTab]][]) {
  els.rail.addEventListener('click', () => toggleBottom(name));
  els.tab.addEventListener('click', () => { setBottomTab(name); setBottomOpen(true); });
}
btnBottomClose.addEventListener('click', () => setBottomOpen(false));

interface Problem {
  severity: 'error' | 'warning';
  message: string;
  line: number;
  col: number;
}

function renderProblems(problems: Problem[]): void {
  if (unchanged('problems', problems.map(p => `${p.severity} ${p.line}:${p.col} ${p.message}`).join('\n'))) return;
  problemsList.replaceChildren();
  problemsEmpty.classList.toggle('hidden', problems.length > 0);

  const errors = problems.filter(p => p.severity === 'error').length;
  const badgeText = String(problems.length);
  problemsBadge.textContent = badgeText;
  problemsCount.textContent = badgeText;
  problemsBadge.classList.toggle('hidden', problems.length === 0);
  problemsCount.classList.toggle('hidden', problems.length === 0);
  problemsBadge.style.background = errors ? 'var(--red)' : 'var(--yellow)';

  for (const p of problems) {
    const li = document.createElement('li');
    li.className = 'problem-row';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const sev = document.createElement('span');
    sev.className = `problem-sev problem-sev--${p.severity}`;
    sev.textContent = p.severity === 'error' ? 'error' : 'warn';

    const msg = document.createElement('span');
    msg.className = 'problem-msg';
    msg.textContent = p.message;

    const loc = document.createElement('span');
    loc.className = 'problem-loc';
    loc.textContent = `${p.line}:${p.col}`;

    li.append(sev, msg, loc);

    const jump = () => {
      editor.revealLineInCenter(p.line);
      editor.setPosition({ lineNumber: p.line, column: p.col });
      editor.focus();
    };
    li.addEventListener('click', jump);
    li.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      jump();
    });
    problemsList.appendChild(li);
  }
}

const localSaves: { when: number; what: string }[] = [];

function noteSave(what: string): void {
  localSaves.unshift({ when: Date.now(), what });
  if (localSaves.length > 20) localSaves.pop();
  if (bottomOpen && bottomTab === 'timeline') void refreshTimeline();
}

function clockLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function refreshTimeline(): Promise<void> {
  const rows: { when: string; kind: string; what: string }[] = localSaves.map(s => ({
    when: clockLabel(s.when),
    kind: 'save',
    what: s.what,
  }));

  const log = await window.electronAPI?.gitHistory(20).catch(() => null);
  if (log?.ok) {
    for (const line of log.lines) {
      const [hash, ...rest] = line.trim().split(/\s+/);
      rows.push({ when: hash.slice(0, 7), kind: 'commit', what: rest.join(' ') });
    }
  }

  timelineList.replaceChildren();
  timelineEmpty.classList.toggle('hidden', rows.length > 0);
  for (const row of rows) {
    const li = document.createElement('li');
    li.className = 'timeline-row';

    const when = document.createElement('span');
    when.className = 'timeline-when';
    when.textContent = row.when;

    const kind = document.createElement('span');
    kind.className = 'timeline-kind';
    kind.textContent = row.kind;

    const what = document.createElement('span');
    what.className = 'timeline-what';
    what.textContent = row.what;

    li.append(when, kind, what);
    timelineList.appendChild(li);
  }
}

// settings
let settingsPanel: SettingsPanel | null = null;
let formatOnSave = initSettings.formatOnSave;

function ensureSettingsPanel(): SettingsPanel {
  if (settingsPanel) return settingsPanel;
  settingsPanel = new SettingsPanel(s => {
    formatOnSave = s.formatOnSave;
    autosaveOn = s.autosave;
    refreshSavedState();
    gitPanel.applyAutofetch(s);
    applyTheme(s.colorTheme);
    applyUiFont(s.uiFontFamily);
    applyUiScale(s.uiScale);
    monaco.editor.setTheme(s.editorTheme);
    editor.updateOptions({
      fontSize:    s.fontSize,
      fontFamily:  s.codeFontFamily,
      lineNumbers: s.lineNumbers,
      minimap:     { enabled: s.minimap },
      wordWrap:    s.wordWrap,
    });
  });
  settingsPanel.setExtraThemes(pluginThemes);
  return settingsPanel;
}

btnSidebarSettings.addEventListener('click', () => ensureSettingsPanel().toggle());

const palette = new CommandPalette();

const NO_BRIDGE = Promise.resolve({
  ok: false as const, errorCode: 'NO_BRIDGE', message: 'Search needs the desktop app.',
});

const searchPanel = new SearchPanel({
  paths: () => recentFiles.map(f => f.path),
  folder: () => (currentPath ? currentPath.replace(/\/[^/]*$/, '') || '/' : null),
  search: (paths, query, useRegex) =>
    window.electronAPI?.searchFiles(paths, query, useRegex) ?? NO_BRIDGE,
  searchFolder: (root, query, useRegex) =>
    window.electronAPI?.searchFolder(root, query, useRegex) ?? NO_BRIDGE,
  pickFolder: () => window.electronAPI?.pickFolder() ?? Promise.resolve(null),
  onOpen: hit => openPath(hit.path, { line: hit.line, col: hit.col }),
});

const baseCommands: PaletteCommand[] = [
  {
    id: 'file.new',
    label: 'new file',
    description: 'Clear the editor and start fresh',
    keybinding: '⌘N',
    action: () => cmdNew(),
  },
  {
    id: 'file.open',
    label: 'open file…',
    description: 'Open a .dsmx file from disk',
    keybinding: '⌘O',
    action: () => cmdOpen(),
  },
  {
    id: 'file.save',
    label: 'save file',
    description: 'Save the current DSL file',
    keybinding: '⌘S',
    action: () => cmdSave(),
  },
  {
    id: 'file.saveas',
    label: 'save file as…',
    description: 'Save to a new location',
    action: () => cmdSave(true),
  },
  {
    id: 'file.exporttex',
    label: 'export tex figure…',
    description: 'Write the graph as a standalone pgfplots document',
    keybinding: '⌘⇧T',
    action: () => cmdExportTex(),
  },
  {
    id: 'graph.reset',
    label: 'reset graph',
    description: 'Clear all expressions from the graph',
    action: () => {
      graph.update([]);
      sourceMap = [];
      graphLink.reset();
      setStatus('Graph reset', 'info');
    },
  },
  {
    id: 'share.copy',
    label: 'copy share link',
    description: 'A link that carries this file, so the reader gets the graph and the source',
    action: () => cmdCopyShareLink(),
  },
  {
    id: 'share.open',
    label: 'open share link',
    description: 'Preview the share link in your browser',
    action: () => cmdOpenShareLink(),
  },
  {
    id: 'graph.export-png',
    label: 'export png…',
    description: 'Write the graph as it looks now to a PNG file',
    keybinding: '⌘⇧E',
    action: () => cmdExportImage('png'),
  },
  {
    id: 'graph.export-svg',
    label: 'export svg…',
    description: 'Write the graph as vector art that stays sharp at any size',
    action: () => cmdExportImage('svg'),
  },
  {
    id: 'editor.format',
    label: 'format code',
    description: 'Auto-format the DSL source',
    keybinding: '⇧⌥F',
    action: () => runEditorAction('editor.action.formatDocument'),
  },
  {
    id: 'editor.find',
    label: 'find',
    description: 'Open the find widget',
    keybinding: '⌘F',
    action: () => runEditorAction('actions.find'),
  },
  {
    id: 'editor.replace',
    label: 'find & replace',
    description: 'Open find & replace widget',
    keybinding: '⌘H',
    action: () => runEditorAction('editor.action.startFindReplaceAction'),
  },
  {
    id: 'mode.dsl',
    label: 'switch to dsl mode',
    description: 'Show only the DSL editor',
    action: () => applyMode('dsl'),
  },
  {
    id: 'mode.split',
    label: 'switch to split mode',
    description: 'Show DSL editor and Enhanced pane side by side',
    action: () => applyMode('split'),
  },
  {
    id: 'mode.enhanced',
    label: 'switch to enhanced mode',
    description: 'Edit the expressions the way Desmos does — every edit goes back into the DSL',
    action: () => applyMode('enhanced'),
  },
  {
    id: 'sidebar.git',
    label: 'toggle source control sidebar',
    description: 'Open or close the Git panel',
    action: () => setSidebarView(sidebarView === 'git' ? null : 'git'),
  },
  {
    id: 'sidebar.ai',
    label: 'toggle ai assistant sidebar',
    description: 'Open or close the AI chat panel',
    action: () => setSidebarView(sidebarView === 'ai' ? null : 'ai'),
  },
  {
    id: 'sidebar.outline',
    label: 'toggle outline sidebar',
    description: 'Open or close the symbol outline',
    action: () => setSidebarView(sidebarView === 'outline' ? null : 'outline'),
  },
  {
    id: 'tool.optimizer',
    label: 'show optimizer report',
    description: 'List every fold, inline and drop the compiler made',
    keybinding: '⌘6',
    action: () => toggleBottom('optimizer'),
  },
  {
    id: 'compile.run',
    label: 'recompile',
    description: 'Manually trigger a DSL recompile',
    action: () => { void runCompile(); setStatus('Recompiling…', 'info'); },
  },
  {
    id: 'editor.rename',
    label: 'rename symbol (f2)',
    description: 'Rename the symbol under the cursor throughout the file',
    keybinding: 'F2',
    action: () => {
      editor.focus();
      void editor.getAction('editor.action.rename')?.run();
    },
  },
  {
    id: 'sidebar.plugins',
    label: 'toggle plugins sidebar',
    description: 'Manage what is installed, and browse the marketplace',
    keybinding: '⌘7',
    action: () => setSidebarView(leftView === 'plugins' ? null : 'plugins'),
  },
  {
    id: 'file.search',
    label: 'search in recent files',
    description: 'Find text across the files you have opened',
    keybinding: '⇧⌘F',
    action: () => searchPanel.show(),
  },
];

function syncRecent(): void {
  refreshPaletteCommands();
  void window.electronAPI?.setRecentFiles(recentFiles.map(f => f.path));
}

function insertAtCursor(text: string): void {
  const pos = editor.getPosition() ?? { lineNumber: 1, column: 1 };
  editor.executeEdits('plugin', [{
    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
    text,
  }]);
  editor.focus();
}

/** with nothing selected a replace is an insert, which is what a plugin means by it */
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
  const paths = recentFiles.map(f => f.path);
  palette.register([
    ...baseCommands,
    ...pluginHost.commands().map(c => ({
      id: `plugin.${c.plugin}.${c.id}`,
      label: c.label,
      description: c.description ?? `from the ${c.plugin} plugin`,
      action: () => runPluginCommand(c.plugin, c.id),
    })),
    ...recentFiles.map(f => {
      const { name, hint } = recentLabel(f.path, paths);
      return {
        id: `file.recent:${f.path}`,
        label: `open recent: ${name}`,
        description: hint || f.path,
        action: () => void openPath(f.path),
      };
    }),
  ]);
}

syncRecent();

async function restoreSession(): Promise<void> {
  const saved = loadSession();
  if (!saved) {
    void setFilename(null);
    applyMode('dsl');
    return;
  }

  restoring = true;
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
        setStatus(`Could not reopen ${saved.path.split(/[\\/]/).pop()}`, 'error');
      }
    } else if (saved.source.trim()) {
      editor.setValue(saved.source);
      void setFilename(null);
    }
    applyMode(saved.mode);
    editor.setPosition({ lineNumber: saved.line, column: saved.col });
    editor.revealLineInCenter(saved.line);
  } finally {
    restoring = false;
  }
  void runCompile();
}

void restoreSession();
refreshSavedState();
void gitPanel.refreshStatus();
gitPanel.applyAutofetch(initSettings);
editor.focus();

window.addEventListener('beforeunload', () => {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistSession();
  searchPanel.dispose();
  sliderManager.dispose();
  aiSidebar?.dispose();
  layout.dispose();
});
