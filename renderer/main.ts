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
import { CompilePipeline } from './compile-pipeline';
import { GraphOnly } from './graph-only';
import { THEMES, monacoTheme } from './themes';
import { compileToTex } from '../src/index';
import { shareUrl } from '../src/share';
import type { CompileResult, SymbolInfo, ExprSource, OptimizeNote } from '../src/index';
import type { DesmosExpr } from '../src/compiler/codegen';
import { DesmosGraph } from './desmos';
import { Layout } from './layout';
import type { EnhancedPane } from './enhanced';
import { Transport } from './transport';
import { SettingsPanel, loadSettings, settingsFromJson, settingsToJson } from './settings';
import type { ColorTheme, EditorSettings, UiScale } from './settings';
import type { AISidebar } from './ai-sidebar';
import type { ConfigEditor } from './config-editor';
import { Keymap, chordOf, keybindsToJson, parseKeybinds, DEFAULT_KEYBINDS } from './keybinds';
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
import { decompile } from '../src/compiler/decompile';
import type { Mode } from './session';
import { WorkspaceState, baseNameOf } from './workspace-state';
import type { ConfigFile } from '../src/shared/rpc-schema';
import exampleSrc from '../example/rose.dsmx?raw';
import { loadSession, recentLabel } from './session';
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
const workspaceState = new WorkspaceState({ onRecents: () => syncRecent() });

let autosaveOn = initSettings.autosave;

for (const theme of THEMES) monaco.editor.defineTheme(theme.id, monacoTheme(theme.id));

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

const statusGraphOnly = $('status-graph-only');
const graphOnly = new GraphOnly();

// an expression with no DSL form is not in the saved file, so it is counted where the user can see it
function noteGraphOnly(refused: string[], seen: (string | undefined)[] = []): void {
  graphOnly.record(refused, seen);
  statusGraphOnly.textContent = graphOnly.label();
  statusGraphOnly.title = graphOnly.title();
  statusGraphOnly.classList.toggle('hidden', graphOnly.count === 0);
  setEnhancedDirty(graphOnly.count > 0);
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
  const refused = writeBackToDsl(exprs);
  noteGraphOnly(refused, exprs.map(e => e.id));
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

// the expression list draws latex with katex, which no other view needs
async function ensureEnhancedPane(): Promise<EnhancedPane> {
  if (enhanced) return enhanced;
  const { EnhancedPane } = await import('./enhanced');
  if (enhanced) return enhanced;
  enhanced = new EnhancedPane(
    document.getElementById('expr-list')!,
    document.getElementById('btn-add-expr') as HTMLButtonElement,
    (list: DesmosExpr[]) => {
      const removed = enhancedSeen.filter(p => !list.some(e => e.id === p.id)).map(p => p.id!);
      const changed = list.filter(e => !enhancedSeen.some(p => same(p, e)));
      enhancedSeen = list.map(e => ({ ...e }));

      const refused = writeBackToDsl(changed, removed);
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

btnExportJson.addEventListener('click', async () => {
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
    if (workspaceState.mode === 'split' || workspaceState.mode === 'enhanced') syncEnhanced();
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

  workspace: () => workspaceState.folder(),
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
    applyMode(workspaceState.mode);
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
function applyMode(m: Mode): void {
  workspaceState.setMode(m);
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
function setFilename(p: string | null): Promise<unknown> {
  if (workspaceState.setPath(p)) void pluginHost.reloadWorkspace();
  const name = workspaceState.name();
  filenameEl.textContent = name;
  tabLabel.textContent = name;
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
  savedDotEl.classList.toggle('hidden', !unsaved);
  tabDot.classList.toggle('hidden', !unsaved);
  savedDotEl.title = workspaceState.path
    ? 'Unsaved changes — ⌘S to write them to the file'
    : 'This buffer has no file yet — ⌘S to choose one';
  filenameEl.classList.toggle('filename--unsaved', unsaved);
  refreshSaveFact(unsaved);
}

function refreshSaveFact(unsaved: boolean): void {
  const on = autosaveOn && !!workspaceState.path;
  statusSave.textContent = on
    ? (unsaved ? 'autosave: saving…' : 'autosave: on')
    : (unsaved ? 'unsaved' : 'saved');
  statusSave.title = on
    ? 'This file is written 1.2 s after you stop typing'
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
  if (workspaceState.mode === 'enhanced' && enhanced?.isDirty) {
    return nativeConfirm('Discard the Enhanced edits? They are not in the DSL file.');
  }
  return true;
}

async function cmdNew(): Promise<void> {
  if (!(await enhancedDirtyGuard())) return;
  stopWatching();
  editor.setValue(DEFAULT_SRC);
  workspaceState.forgetSaved();
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
  applyMode(workspaceState.mode === 'enhanced' ? 'dsl' : workspaceState.mode);
  void runCompile();
  persistSession();
}

async function cmdSave(saveAs = false): Promise<void> {
  if (formatOnSave) await formatDocument();
  const sent = editor.getValue();
  const result = await window.electronAPI?.saveFile(saveAs ? null : workspaceState.path, sent);
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
    title: baseNameOf(workspaceState.path) ?? 'an unsaved file',
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
  return baseNameOf(workspaceState.path)?.replace(/\.dsmx$/, '') ?? 'desmos-graph';
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
  if (!autosaveOn || !path || workspaceState.autosaving) return;
  workspaceState.autosaving = true;
  try {
    const sent = editor.getValue();
    const result = await window.electronAPI?.saveFile(path, sent);
    if (result?.ok) {
      markSaved(sent);
      noteSave(`${baseNameOf(path)} (autosave)`);
      setStatus('Autosaved', 'info');
    }
    else if (result && !result.canceled) setStatus(result.message, 'error');
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
  if (workspaceState.mode === 'enhanced') applyMode('dsl');
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

// the chat panel is a large part of the bundle and most sessions never open it
async function ensureAiSidebar(): Promise<AISidebar> {
  if (aiSidebar) return aiSidebar;
  const { AISidebar } = await import('./ai-sidebar');
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
    void ensureAiSidebar();
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
  }, file => void openConfigFile(file));
  settingsPanel.setExtraThemes(pluginThemes);
  return settingsPanel;
}

btnSidebarSettings.addEventListener('click', () => ensureSettingsPanel().toggle());

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

const baseCommands: PaletteCommand[] = [
  {
    id: 'file.new',
    label: 'new file',
    description: 'Clear the editor and start fresh',
    action: () => cmdNew(),
  },
  {
    id: 'file.open',
    label: 'open file…',
    description: 'Open a .dsmx file from disk',
    action: () => cmdOpen(),
  },
  {
    id: 'file.save',
    label: 'save file',
    description: 'Save the current DSL file',
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
    action: () => runEditorAction('actions.find'),
  },
  {
    id: 'editor.replace',
    label: 'find & replace',
    description: 'Open find & replace widget',
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
    action: () => setSidebarView(leftView === 'git' ? null : 'git'),
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
    action: () => setSidebarView(leftView === 'outline' ? null : 'outline'),
  },
  {
    id: 'tool.optimizer',
    label: 'show optimizer report',
    description: 'List every fold, inline and drop the compiler made',
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
    action: () => setSidebarView(leftView === 'plugins' ? null : 'plugins'),
  },
  {
    id: 'file.search',
    label: 'search in recent files',
    description: 'Find text across the files you have opened',
    action: () => searchPanel.show(),
  },
  {
    id: 'editor.find-regex',
    label: 'find with a regular expression',
    description: 'Open the find widget with regex matching already on',
    action: () => runFindWithRegex(),
  },
  {
    id: 'palette.toggle',
    label: 'show all commands',
    description: 'Open or close this palette',
    action: () => palette.toggle(),
  },
  {
    id: 'tool.problems',
    label: 'toggle problems panel',
    description: 'Open or close the list of compile errors',
    action: () => toggleBottom('problems'),
  },
  {
    id: 'tool.timeline',
    label: 'toggle timeline panel',
    description: 'Open or close the record of what the session did',
    action: () => toggleBottom('timeline'),
  },
  {
    id: 'preferences.open',
    label: 'preferences: open settings',
    description: 'The settings dialog',
    action: () => ensureSettingsPanel().toggle(),
  },
  {
    id: 'preferences.settings-json',
    label: 'preferences: open settings.json',
    description: 'Edit every setting as text — this file is what the app reads',
    action: () => void openConfigFile('settings'),
  },
  {
    id: 'preferences.keybinds-json',
    label: 'preferences: open keybinds.json',
    description: 'Bind your own keys to any command in this palette',
    action: () => void openConfigFile('keybinds'),
  },
  {
    id: 'preferences.reset-keybinds',
    label: 'preferences: reset keybinds',
    description: 'Write the default keys back into keybinds.json',
    action: () => cmdResetKeybinds(),
  },
  {
    id: 'preferences.export',
    label: 'preferences: export settings…',
    description: 'Write the current settings to a JSON file you can carry',
    action: () => cmdExportSettings(),
  },
  {
    id: 'preferences.import',
    label: 'preferences: import settings…',
    description: 'Read settings back from a JSON file',
    action: () => cmdImportSettings(),
  },
  {
    id: 'help.tour',
    label: 'help: run the welcome tour',
    description: 'Point out the editor, the graph and the palette again',
    action: () => onboarding.start(),
  },
];

const keymap = new Keymap();
const commandIndex = new Map<string, PaletteCommand>();

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
      target: () => editorContainer,
      title: 'write dsmx here',
      body: 'One statement per line. Every line you write compiles to a Desmos expression as you type.',
    },
    {
      target: () => graphContainer,
      title: 'the graph is the output',
      body: 'It follows the file. Click an expression and the editor moves to the line that made it.',
    },
    {
      target: () => document.getElementById('statusbar'),
      title: 'the status bar tells you the state',
      body: 'Compile result, branch, cursor position and whether the file has unsaved work.',
    },
    {
      target: () => searchWidget,
      title: 'every command is here',
      body: 'Press ⇧⌘P for the palette. Files, export, git, plugins and preferences all start there.',
    },
  ],
  openExample: () => { editor.setValue(exampleSrc); void runCompile(); },
  onFinish: () => ensureSettingsPanel().patch({ tourDone: true }),
});

function settingsNow(): EditorSettings {
  return settingsPanel ? settingsPanel.current() : initSettings;
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
  const settings = await window.electronAPI?.configRead('settings');
  if (settings) {
    if (settings.content.trim().replace(/[{}\s]/g, '') === '') {
      void window.electronAPI?.configWrite('settings', settingsToJson(settingsNow()));
    } else {
      applyConfig('settings', settings.content);
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
  setStatus(ok ? 'Keybinds reset to the defaults' : 'Could not write keybinds.json', ok ? 'success' : 'error');
}

async function cmdExportSettings(): Promise<void> {
  const result = await window.electronAPI?.exportJson(settingsToJson(settingsNow()), 'dsmx-settings.json');
  if (!result) { setStatus('Exporting settings needs the desktop app.', 'error'); return; }
  if (!result.ok) {
    if (!result.canceled) setStatus(result.message, 'error');
    return;
  }
  setStatus(`Settings written to ${result.path}`, 'success');
}

async function cmdImportSettings(): Promise<void> {
  const result = await window.electronAPI?.openJsonFile();
  if (!result) { setStatus('Importing settings needs the desktop app.', 'error'); return; }
  if (!result.ok) {
    if (!result.canceled) setStatus(result.message, 'error');
    return;
  }
  const next = settingsFromJson(result.content);
  if (!next) { setStatus('That file is not a settings file.', 'error'); return; }
  ensureSettingsPanel().patch(next);
  setStatus('Settings imported', 'success');
}

function syncRecent(): void {
  refreshPaletteCommands();
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
}

syncRecent();

async function restoreSession(): Promise<void> {
  const saved = loadSession();
  if (!saved) {
    void setFilename(null);
    applyMode('dsl');
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
