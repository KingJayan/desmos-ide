import './bridge';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
(globalThis as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker() { return new EditorWorker(); },
};

import * as monaco from 'monaco-editor';
import { createIcons, GitBranch, Bot, Settings, RefreshCw, GitBranchPlus, Plus, List } from 'lucide';
import { registerLanguage, errorToMarker, LANGUAGE_ID, KEYWORDS, BUILTIN_FNS } from '../src/monaco/language';
import { builtinSignature } from '../src/compiler/builtins';
import { formatDsl } from '../src/compiler/format';
import { findRenameEdits, isValidIdent } from '../src/compiler/rename';
import CompileWorker from './compile.worker?worker';
import type { CompileResult, SymbolInfo, ExprSource } from '../src/index';
import type { DesmosExpr } from '../src/compiler/codegen';
import { DesmosGraph } from './desmos';
import { EnhancedPane } from './enhanced';
import { Transport } from './transport';
import { AISidebar } from './ai-sidebar';
import { SettingsPanel, loadSettings } from './settings';
import type { ColorTheme, EditorSettings } from './settings';
import { compileStatus, errorsByPhase } from './compile-status';
import { CommandPalette } from './command-palette';
import type { PaletteCommand } from './command-palette';
import { InlineSliderManager } from './inline-sliders';
import { SearchPanel } from './search-panel';
import { GraphLink } from './graph-link';
import { decompile } from '../src/compiler/decompile';
import type { Mode } from './session';
import {
  loadRecent, loadSession, pushRecent, recentLabel, removeRecent, saveRecent, saveSession,
} from './session';
import { registerColorProvider } from './color-provider';

registerLanguage(monaco as Parameters<typeof registerLanguage>[0]);
registerColorProvider();
createIcons({
  icons: { GitBranch, Bot, Settings, RefreshCw, GitBranchPlus, Plus, List },
  attrs: { 'stroke-width': '1.9' },
});


const editorContainer = document.getElementById('editor-container')!;
const graphContainer  = document.getElementById('graph-container')!;
const dslPane         = document.getElementById('dsl-pane')!;
const enhancedPane    = document.getElementById('enhanced-pane')!;
const btnDsl          = document.getElementById('btn-dsl')      as HTMLButtonElement;
const btnSplit        = document.getElementById('btn-split')    as HTMLButtonElement;
const btnEnhanced     = document.getElementById('btn-enhanced') as HTMLButtonElement;
const paneDivider     = document.getElementById('pane-divider')!;
const btnNew          = document.getElementById('btn-new')      as HTMLButtonElement;
const btnOpen         = document.getElementById('btn-open')     as HTMLButtonElement;
const btnSave         = document.getElementById('btn-save')     as HTMLButtonElement;
const filenameEl      = document.getElementById('filename')!;
const statusMsg       = document.getElementById('status-msg')!;
const gitBranchEl     = document.getElementById('git-branch') as HTMLSpanElement;
const gitSummaryMsg   = document.getElementById('git-summary-msg')!;
const gitRefreshStatusBtn = document.getElementById('git-refresh-status') as HTMLButtonElement;
const gitBranchPanelTitle = document.getElementById('git-branch-panel-title')!;
const gitBranchEmpty  = document.getElementById('git-branch-empty')!;
const gitBranchList   = document.getElementById('git-branch-list')!;
const gitBranchRefreshBtn = document.getElementById('git-branch-refresh') as HTMLButtonElement;
const gitBranchCreateBtn = document.getElementById('git-branch-create') as HTMLButtonElement;
const gitHistoryEmpty = document.getElementById('git-history-empty')!;
const gitHistoryContent = document.getElementById('git-history-content')!;
const gitHistoryRefreshBtn = document.getElementById('git-history-refresh') as HTMLButtonElement;
const gitRemotePanelTitle = document.getElementById('git-remote-panel-title')!;
const gitRemoteEmpty  = document.getElementById('git-remote-empty')!;
const gitRemoteList   = document.getElementById('git-remote-list')!;
const gitRemoteRefreshBtn = document.getElementById('git-remote-refresh') as HTMLButtonElement;
const gitRemoteAddBtn = document.getElementById('git-remote-add') as HTMLButtonElement;
const gitModifiedEl   = document.getElementById('git-modified') as HTMLSpanElement;
const gitModifiedPanelTitle = document.getElementById('git-modified-panel-title')!;
const gitModifiedEmpty = document.getElementById('git-modified-empty')!;
const gitModifiedList = document.getElementById('git-modified-list')!;
const dividerEl       = document.getElementById('divider')!;
const leftPanel       = document.getElementById('left-panel')!;
const workspace       = document.getElementById('workspace')!;
const btnSidebarGit      = document.getElementById('btn-sidebar-git')      as HTMLButtonElement;
const btnSidebarAi       = document.getElementById('btn-sidebar-ai')       as HTMLButtonElement;
const btnSidebarOutline  = document.getElementById('btn-sidebar-outline')  as HTMLButtonElement;
const btnSidebarSettings = document.getElementById('btn-sidebar-settings') as HTMLButtonElement;
const gitContainer       = document.getElementById('git-sidebar-container')!;
const outlineContainer   = document.getElementById('outline-sidebar-container')!;
const outlineList        = document.getElementById('outline-list')!;
const outlineEmpty       = document.getElementById('outline-empty')!;
const aiPanel            = document.getElementById('ai-panel')!;
const aiDivider          = document.getElementById('ai-divider')!;
const aiContainer        = document.getElementById('ai-sidebar-container')!;


const DEFAULT_SRC = `// desmos DSL snippet

a = slider(0, 0, 6.28)

fn osc(x, k) = sin(k * x + a)

curve ripple (t in 0..6.28) { (cos(t), sin(t)) }

point origin (0, 0) as { color blue pointSize 8 }

region upper = y > osc(x, 2) as { color purple opacity 0.15 }

text lbl = "hello, desmos" at (0, 1.5)
`;

const initSettings = loadSettings();

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
  padding: { top: 12 },
  renderWhitespace: 'none',
  smoothScrolling: true,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
});


const graph = new DesmosGraph(graphContainer);

// the timeline bar drives the one `time` clock the source declares
const transport = new Transport(document.getElementById('transport')!, {
  setPlaying: (id, playing) => graph.setClockPlaying(id, playing),
  setPeriod:  (id, period)  => graph.setClockPeriod(id, period),
  setValue:   (id, name, v) => graph.setClockValue(id, name, v),
  watch:      (name, cb)    => graph.watchClock(name, cb),
});

// clicking a curve on the graph puts the cursor on the line that drew it, and
// moving the cursor selects that curve back on the graph
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

/* edits on the graph sync back */
graph.onExpressionEdited(exprs => {
  const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
  const refused: string[] = [];

  for (const expr of exprs) {
    const at = sourceMap.find(e => e.id === expr.id);
    if (!at) continue;

    const statement = decompile(expr, expr.id);
    if (!statement) { refused.push(expr.id); continue; }

    const nextLine = sourceMap
      .filter(e => e.line > at.line)
      .reduce((min, e) => Math.min(min, e.line), model.getLineCount() + 1);
    let endLine = Math.min(Math.max(at.line, nextLine - 1), model.getLineCount());

    //keep blanklines
    while (endLine > at.line && model.getLineContent(endLine).trim() === '') endLine--;

    const original = model.getValueInRange(
      new monaco.Range(at.line, 1, endLine, model.getLineMaxColumn(endLine)),
    );
    const indent = /^\s*/.exec(original)?.[0] ?? '';
    const style = / as \{[^}]*\}\s*$/.exec(original)?.[0] ?? '';

    edits.push({
      range: new monaco.Range(at.line, 1, endLine, model.getLineMaxColumn(endLine)),
      text: indent + statement + style.trimEnd(),
    });
  }

  if (edits.length) {
    editor.executeEdits('graph-writeback', edits);
  }
  if (refused.length) {
    setStatus(`Cannot write back as DSL: ${refused.join(', ')}`, 'error');
  }
});

editor.onDidChangeCursorPosition(e => graphLink.onCursorMoved(e.position.lineNumber));

function applyTheme(theme: ColorTheme): void {
  document.documentElement.setAttribute('data-color-theme', theme);
  graph.setTheme(theme);
}

function applyUiFont(fontFamily: string): void {
  document.documentElement.style.setProperty('--font-ui', fontFamily);
}

applyTheme(initSettings.colorTheme);
applyUiFont(initSettings.uiFontFamily);
monaco.editor.setTheme(initSettings.editorTheme);


let enhanced: EnhancedPane | null = null;
const enhancedUnsavedBar = document.getElementById('enhanced-unsaved-bar')!;
const btnExportJson = document.getElementById('btn-export-json') as HTMLButtonElement;

function setEnhancedDirty(dirty: boolean): void {
  enhancedUnsavedBar.classList.toggle('hidden', !dirty);
}

function ensureEnhancedPane(): EnhancedPane {
  if (enhanced) return enhanced;
  enhanced = new EnhancedPane(
    document.getElementById('expr-list')!,
    document.getElementById('btn-add-expr') as HTMLButtonElement,
    (list: DesmosExpr[], dirty: boolean) => {
      graph.update(list);
      setEnhancedDirty(dirty);
    },
  );
  return enhanced;
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
};

function renderOutline(symbols: SymbolInfo[]): void {
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
    li.addEventListener('click', () => {
      editor.revealLineInCenter(sym.line);
      editor.setPosition({ lineNumber: sym.line, column: sym.col });
      editor.focus();
    });
    outlineList.appendChild(li);
  }
}

let lastCompileResult: CompileResult | null = null;
const sliderManager = new InlineSliderManager(editor);
window.addEventListener('beforeunload', () => {
  sliderManager.dispose();
  aiSidebar?.dispose();
});

function handleCompileResult(result: CompileResult): void {
  lastCompileResult = result;
  if (result.success) {
    monaco.editor.setModelMarkers(model, 'desmos-dsl-syntax', []);
    monaco.editor.setModelMarkers(model, 'desmos-dsl-semantic', []);
    monaco.editor.setModelMarkers(model, 'desmos-dsl', result.warnings);
    if (mode !== 'enhanced') {
      graph.update(result.state.expressions.list);
    }
    sourceMap = result.sourceMap;
    if (mode === 'split') {
      ensureEnhancedPane().syncFromGraph(graph.currentList());
    }
    sliderManager.update(editor.getValue());
    renderOutline(result.symbols);
    transport.setClock(result.clock);
  } else {
    const { syntax, semantic } = errorsByPhase(result.errors, errorToMarker);
    monaco.editor.setModelMarkers(model, 'desmos-dsl-syntax', syntax);
    monaco.editor.setModelMarkers(model, 'desmos-dsl-semantic', semantic);
    // the last good graph stays on screen, so the bar keeps driving its clock
  }
  const { msg, kind } = compileStatus(result);
  setStatus(msg, kind);
}

const BUILTIN_SIGS: Record<string, string> = {
  gradient: 'gradient(from, to) → color',
};

// makes ⇧⌥F and the "Format Code" palette entry real
// makes ⇧⌥F and the "Format Code" palette entry real, and gives format-on-save
// something to call
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

    const sig = builtinSignature(word.word) ?? BUILTIN_SIGS[word.word];
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
    const { id, result } = event.data;
    if (id !== compileRequestId) return;
    handleCompileResult(result);
  });
  w.addEventListener('error', (e: ErrorEvent) => {
    console.error('[compile-worker] error:', e.message);
    if (workerRestarts < MAX_WORKER_RESTARTS) {
      workerRestarts++;
      setStatus(`⚠ Compiler restarting (${workerRestarts}/${MAX_WORKER_RESTARTS})…`, 'info');
      w.terminate();
      activeWorker = spawnWorker();
      runCompile();
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

function runCompile(): void {
  if (!activeWorker) return;
  const src = editor.getValue();
  compileRequestId += 1;
  activeWorker.postMessage({ id: compileRequestId, src });
}

editor.onDidChangeModelContent(() => {
  if (compileTimer !== null) clearTimeout(compileTimer);
  compileTimer = setTimeout(runCompile, 280);
  schedulePersist();
});

window.addEventListener('unload', () => {
  activeWorker?.terminate();
  activeWorker = null;
  stopWatching();
  enhanced?.dispose();
  transport.dispose();
  if (gitRefreshTimer) {
    clearInterval(gitRefreshTimer);
    gitRefreshTimer = null;
  }
});

function setStatus(msg: string, kind: 'success' | 'error' | 'info' = 'info'): void {
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

type GitStatusResult =
  | { ok: true; branch: string; modifiedCount: number; modifiedFiles: string[] }
  | { ok: false; errorCode: string; message: string };
type GitBranchesResult =
  | { ok: true; currentBranch: string; branches: Array<{ name: string; current: boolean; upstream: string | null; tracking: string | null }> }
  | { ok: false; errorCode: string; message: string };
type GitHistoryResult =
  | { ok: true; lines: string[] }
  | { ok: false; errorCode: string; message: string };
type GitRemotesResult =
  | { ok: true; remotes: Array<{ name: string; fetchUrl: string; pushUrl: string }> }
  | { ok: false; errorCode: string; message: string };
type GitActionResult =
  | { ok: true; message: string }
  | { ok: false; errorCode: string; message: string };

let gitRefreshTimer: ReturnType<typeof setInterval> | null = null;
let gitRefreshInFlight = false;
let gitLastStatus: GitStatusResult = {
  ok: false,
  errorCode: 'INIT',
  message: 'Loading Git status...',
};

function renderGitModifiedPanel(status: GitStatusResult): void {
  gitModifiedList.innerHTML = '';

  if (!status.ok) {
    gitModifiedPanelTitle.textContent = 'Git status';
    gitModifiedEmpty.textContent = status.message;
    gitModifiedEmpty.classList.add('git-modified-empty--show');
    return;
  }

  gitModifiedPanelTitle.textContent = status.modifiedCount === 1 ? '1 modified file' : `${status.modifiedCount} modified files`;
  if (status.modifiedCount === 0) {
    gitModifiedEmpty.textContent = 'Working tree clean';
    gitModifiedEmpty.classList.add('git-modified-empty--show');
    return;
  }

  gitModifiedEmpty.classList.remove('git-modified-empty--show');
  for (const file of status.modifiedFiles) {
    const li = document.createElement('li');
    li.textContent = file;
    li.title = file;
    gitModifiedList.appendChild(li);
  }
}

function setGitPillState(kind: 'clean' | 'dirty' | 'unknown'): void {
  gitBranchEl.classList.remove('git-pill--clean', 'git-pill--dirty', 'git-pill--unknown');
  gitModifiedEl.classList.remove('git-pill--clean', 'git-pill--dirty', 'git-pill--unknown');
  gitBranchEl.classList.add(`git-pill--${kind}`);
  gitModifiedEl.classList.add(`git-pill--${kind}`);
}

function renderGitStatus(status: GitStatusResult): void {
  gitLastStatus = status;
  renderGitModifiedPanel(status);

  if (!status.ok) {
    gitBranchEl.textContent = 'branch: --';
    gitModifiedEl.textContent = 'git unavailable';
    gitSummaryMsg.textContent = status.message;
    setGitPillState('unknown');
    return;
  }

  gitBranchEl.textContent = `branch: ${status.branch}`;
  gitModifiedEl.textContent = status.modifiedCount === 1 ? '1 modified' : `${status.modifiedCount} modified`;
  gitSummaryMsg.textContent = status.modifiedCount
    ? status.modifiedFiles.slice(0, 12).join(' | ')
    : 'Working tree clean';
  setGitPillState(status.modifiedCount > 0 ? 'dirty' : 'clean');
}

function renderGitBranches(result: GitBranchesResult): void {
  gitBranchList.innerHTML = '';

  if (!result.ok) {
    gitBranchPanelTitle.textContent = 'Branches';
    gitBranchEmpty.textContent = result.message;
    gitBranchEmpty.classList.add('git-modified-empty--show');
    return;
  }

  gitBranchPanelTitle.textContent = `Branches (${result.branches.length})`;
  if (result.branches.length === 0) {
    gitBranchEmpty.textContent = 'No branches found';
    gitBranchEmpty.classList.add('git-modified-empty--show');
    return;
  }

  gitBranchEmpty.classList.remove('git-modified-empty--show');
  for (const branch of result.branches) {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'git-branch-row';

    const meta = document.createElement('div');
    meta.className = 'git-branch-meta';
    const name = document.createElement('div');
    name.className = 'git-branch-name';
    name.textContent = branch.current ? `* ${branch.name}` : branch.name;
    name.title = branch.name;
    meta.appendChild(name);

    if (branch.upstream) {
      const upstream = document.createElement('div');
      upstream.className = 'git-branch-upstream';
      upstream.textContent = branch.tracking
        ? `${branch.upstream} (${branch.tracking})`
        : branch.upstream;
      meta.appendChild(upstream);
    }

    row.appendChild(meta);

    if (!branch.current) {
      const actions = document.createElement('div');
      actions.className = 'git-inline-actions';
      const checkout = document.createElement('button');
      checkout.type = 'button';
      checkout.className = 'git-panel-btn';
      checkout.textContent = 'Checkout';
      checkout.addEventListener('click', async e => {
        e.stopPropagation();
        const action = await window.electronAPI?.gitCheckoutBranch(branch.name);
        handleGitActionResult(action);
        await Promise.all([refreshGitStatus(), refreshGitBranches(), refreshGitHistory()]);
      });
      actions.appendChild(checkout);
      row.appendChild(actions);
    }

    li.appendChild(row);
    gitBranchList.appendChild(li);
  }
}

function renderGitHistory(result: GitHistoryResult): void {
  if (!result.ok) {
    gitHistoryEmpty.textContent = result.message;
    gitHistoryEmpty.classList.add('git-modified-empty--show');
    gitHistoryContent.classList.remove('git-history-content--show');
    gitHistoryContent.textContent = '';
    return;
  }

  if (result.lines.length === 0) {
    gitHistoryEmpty.textContent = 'No history found';
    gitHistoryEmpty.classList.add('git-modified-empty--show');
    gitHistoryContent.classList.remove('git-history-content--show');
    gitHistoryContent.textContent = '';
    return;
  }

  gitHistoryEmpty.classList.remove('git-modified-empty--show');
  gitHistoryContent.classList.add('git-history-content--show');
  gitHistoryContent.textContent = result.lines.join('\n');
}

function renderGitRemotes(result: GitRemotesResult): void {
  gitRemoteList.innerHTML = '';

  if (!result.ok) {
    gitRemotePanelTitle.textContent = 'Remotes';
    gitRemoteEmpty.textContent = result.message;
    gitRemoteEmpty.classList.add('git-modified-empty--show');
    return;
  }

  gitRemotePanelTitle.textContent = `Remotes (${result.remotes.length})`;

  if (result.remotes.length === 0) {
    gitRemoteEmpty.textContent = 'No remotes configured';
    gitRemoteEmpty.classList.add('git-modified-empty--show');
    return;
  }

  gitRemoteEmpty.classList.remove('git-modified-empty--show');
  for (const remote of result.remotes) {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'git-remote-row';

    const meta = document.createElement('div');
    meta.className = 'git-remote-meta';
    const name = document.createElement('div');
    name.className = 'git-branch-name';
    name.textContent = remote.name;
    meta.appendChild(name);
    const fetchUrl = document.createElement('div');
    fetchUrl.className = 'git-remote-url';
    fetchUrl.textContent = `fetch: ${remote.fetchUrl || '--'}`;
    meta.appendChild(fetchUrl);
    const pushUrl = document.createElement('div');
    pushUrl.className = 'git-remote-url';
    pushUrl.textContent = `push: ${remote.pushUrl || '--'}`;
    meta.appendChild(pushUrl);
    row.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'git-inline-actions';

    const fetchBtn = document.createElement('button');
    fetchBtn.type = 'button';
    fetchBtn.className = 'git-panel-btn';
    fetchBtn.textContent = 'Fetch';
    fetchBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const action = await window.electronAPI?.gitFetch(remote.name);
      handleGitActionResult(action);
      await Promise.all([refreshGitStatus(), refreshGitHistory()]);
    });

    const pullBtn = document.createElement('button');
    pullBtn.type = 'button';
    pullBtn.className = 'git-panel-btn';
    pullBtn.textContent = 'Pull';
    pullBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const branch = gitLastStatus.ok ? gitLastStatus.branch : undefined;
      const action = await window.electronAPI?.gitPull(remote.name, branch);
      handleGitActionResult(action);
      await Promise.all([refreshGitStatus(), refreshGitHistory()]);
    });

    const pushBtn = document.createElement('button');
    pushBtn.type = 'button';
    pushBtn.className = 'git-panel-btn';
    pushBtn.textContent = 'Push';
    pushBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const branch = gitLastStatus.ok ? gitLastStatus.branch : undefined;
      const action = await window.electronAPI?.gitPush(remote.name, branch);
      handleGitActionResult(action);
      await Promise.all([refreshGitStatus(), refreshGitHistory()]);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'git-panel-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!(await nativeConfirm(`Remove remote ${remote.name}?`))) return;
      const action = await window.electronAPI?.gitRemoteRemove(remote.name);
      handleGitActionResult(action);
      await refreshGitRemotes();
    });

    actions.appendChild(fetchBtn);
    actions.appendChild(pullBtn);
    actions.appendChild(pushBtn);
    actions.appendChild(removeBtn);
    row.appendChild(actions);
    li.appendChild(row);
    gitRemoteList.appendChild(li);
  }
}

function handleGitActionResult(result: GitActionResult | undefined): void {
  if (!result) return;
  if (result.ok) {
    setStatus(result.message, 'success');
  } else {
    setStatus(result.message, 'error');
  }
}

async function refreshGitStatus(): Promise<void> {
  if (gitRefreshInFlight) return;
  gitRefreshInFlight = true;
  try {
    const result = await window.electronAPI?.gitStatus();
    if (result) renderGitStatus(result);
  } catch (err) {
    renderGitStatus({ ok: false, errorCode: 'UNKNOWN', message: String(err) });
  } finally {
    gitRefreshInFlight = false;
  }
}

async function refreshGitBranches(): Promise<void> {
  try {
    const result = await window.electronAPI?.gitBranches();
    if (result) renderGitBranches(result);
  } catch (err) {
    renderGitBranches({ ok: false, errorCode: 'UNKNOWN', message: String(err) });
  }
}

async function refreshGitHistory(): Promise<void> {
  try {
    const result = await window.electronAPI?.gitHistory(50);
    if (result) renderGitHistory(result);
  } catch (err) {
    renderGitHistory({ ok: false, errorCode: 'UNKNOWN', message: String(err) });
  }
}

async function refreshGitRemotes(): Promise<void> {
  try {
    const result = await window.electronAPI?.gitRemotes();
    if (result) renderGitRemotes(result);
  } catch (err) {
    renderGitRemotes({ ok: false, errorCode: 'UNKNOWN', message: String(err) });
  }
}

// a fetch reaches the network, so it never runs behind a hidden window
async function autofetchTick(): Promise<void> {
  if (document.visibilityState !== 'visible') return;
  const action = await window.electronAPI?.gitFetch();
  if (!action?.ok) return;
  await Promise.all([refreshGitStatus(), refreshGitBranches()]);
}

function applyGitAutofetch(s: Pick<EditorSettings, 'gitAutofetch' | 'gitAutofetchPeriod'>): void {
  if (gitRefreshTimer) {
    clearInterval(gitRefreshTimer);
    gitRefreshTimer = null;
  }
  if (!s.gitAutofetch) return;
  gitRefreshTimer = setInterval(() => { void autofetchTick(); }, s.gitAutofetchPeriod * 1000);
}

runCompile();

//mode switching
let mode: Mode = 'dsl';

function applyMode(m: Mode): void {
  mode = m;
  btnDsl.classList.toggle('active', m === 'dsl');
  btnSplit.classList.toggle('active', m === 'split');
  btnEnhanced.classList.toggle('active', m === 'enhanced');

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
    ensureEnhancedPane().syncFromGraph(graph.currentList());
    setEnhancedDirty(false);
  }
  if (showDsl) editor.layout();
}

async function setMode(m: Mode): Promise<void> {
  if (m !== 'enhanced' && mode === 'enhanced' && enhanced?.isDirty) {
    if (!(await nativeConfirm('Leave Enhanced mode? Edits made here are not in the DSL file and will be lost.'))) return;
  }
  applyMode(m);
}

btnDsl.addEventListener('click', () => setMode('dsl'));
btnSplit.addEventListener('click', () => setMode('split'));
btnEnhanced.addEventListener('click', () => setMode('enhanced'));

//file ops
let currentPath: string | null = null;
let watchedPath: string | null = null;

// the git panel follows the open file, so point the main process at it before refreshing
function setFilename(p: string | null): Promise<unknown> {
  currentPath = p;
  if (p) rememberRecent(p);
  filenameEl.textContent = p ? p.split(/[\\/]/).pop()! : 'untitled.dsmx';
  return Promise.resolve(window.electronAPI?.setGitContext(p)).then(refreshGitPanels);
}

function refreshGitPanels(): Promise<unknown> {
  return Promise.all([refreshGitStatus(), refreshGitBranches(), refreshGitHistory(), refreshGitRemotes()]);
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
  setStatus('↻ Reloaded from disk', 'info');
  runCompile();
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
  void setFilename(null);
  setStatus('New file', 'info');
  applyMode('dsl');
  runCompile();
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
  void setFilename(result.path);
  startWatching(result.path);
  applyMode(mode === 'enhanced' ? 'dsl' : mode);
  runCompile();
  persistSession();
}

async function cmdSave(saveAs = false): Promise<void> {
  if (mode === 'enhanced') {
    setStatus('Enhanced mode edits the graph, not the file — switch to DSL to save, or Export JSON', 'error');
    return;
  }
  if (formatOnSave) await formatDocument();
  const result = await window.electronAPI?.saveFile(
    saveAs ? null : currentPath,
    editor.getValue(),
  );
  if (!result) return;
  if (result.ok) {
    void setFilename(result.path);
    startWatching(result.path);
    setStatus('Saved', 'success');
    persistSession();
  } else if (!result.canceled) {
    setStatus(result.message, 'error');
  }
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

// writes straight to the open file. an untitled buffer is never given a path
// behind the user's back, so it only rides along in the restored session.
async function autosave(): Promise<void> {
  if (!currentPath || mode === 'enhanced' || autosaving) return;
  autosaving = true;
  try {
    const result = await window.electronAPI?.saveFile(currentPath, editor.getValue());
    if (result?.ok) setStatus('Autosaved', 'info');
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
  void setFilename(result.path);
  startWatching(result.path);
  if (mode === 'enhanced') applyMode('dsl');
  if (at) {
    editor.setPosition({ lineNumber: at.line, column: at.col });
    editor.revealLineInCenter(at.line);
  }
  editor.focus();
  runCompile();
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
    e.preventDefault();
    runEditorAction('actions.find');
    return;
  }

  if (!e.altKey && k === 'h') {
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
    e.preventDefault();
    runFindWithRegex();
    return;
  }

  if (e.shiftKey && !e.altKey && k === 'p') {
    e.preventDefault();
    palette.toggle();
    return;
  }
});

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
window.electronAPI?.onMenuOpenRecent(path => void openPath(path));

window.addEventListener('focus', () => {
  void Promise.all([refreshGitStatus(), refreshGitBranches(), refreshGitRemotes()]);
});

gitRefreshStatusBtn.addEventListener('click', () => {
  void refreshGitPanels();
});

gitBranchRefreshBtn.addEventListener('click', e => {
  e.stopPropagation();
  void refreshGitBranches();
});

gitHistoryRefreshBtn.addEventListener('click', e => {
  e.stopPropagation();
  void refreshGitHistory();
});

gitRemoteRefreshBtn.addEventListener('click', e => {
  e.stopPropagation();
  void refreshGitRemotes();
});

gitBranchCreateBtn.addEventListener('click', async e => {
  e.stopPropagation();
  const raw = await nativePrompt('New branch name:');
  const name = raw?.trim();
  if (!name) return;
  const action = await window.electronAPI?.gitCreateBranch(name);
  handleGitActionResult(action);
  await Promise.all([refreshGitStatus(), refreshGitBranches(), refreshGitHistory()]);
});

gitRemoteAddBtn.addEventListener('click', async e => {
  e.stopPropagation();
  const nameRaw = await nativePrompt('Remote name:', 'origin');
  const name = nameRaw?.trim();
  if (!name) return;
  const urlRaw = await nativePrompt(`Remote URL for ${name}:`);
  const url = urlRaw?.trim();
  if (!url) return;
  const action = await window.electronAPI?.gitRemoteAdd(name, url);
  handleGitActionResult(action);
  await refreshGitRemotes();
});

//divider drag
let dragging = false;

dividerEl.addEventListener('mousedown', e => {
  dragging = true;
  dividerEl.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (dragging) {
    const rect = workspace.getBoundingClientRect();
    const w = Math.max(280, Math.min(e.clientX - rect.left, rect.width - 204));
    leftPanel.style.width = `${w}px`;
    editor.layout();
  }
  if (paneDragging) {
    const rect = leftPanel.getBoundingClientRect();
    const h = Math.max(80, Math.min(e.clientY - rect.top, rect.height - 84));
    dslPane.style.flex = 'none';
    dslPane.style.height = `${h}px`;
    editor.layout();
  }
});

let paneDragging = false;

paneDivider.addEventListener('mousedown', e => {
  paneDragging = true;
  paneDivider.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('mouseup', () => {
  if (dragging) { dragging = false; dividerEl.classList.remove('dragging'); }
  if (aiDragging) { aiDragging = false; aiDivider.classList.remove('dragging'); }
  if (paneDragging) { paneDragging = false; paneDivider.classList.remove('dragging'); }
});

// sidebar
type SidebarView = 'git' | 'ai' | 'outline' | null;
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
  // Hook editor selection changes to update the context pill
  if (!aiSelectionListener) {
    aiSelectionListener = editor.onDidChangeCursorSelection(() => {
      aiSidebar?.refreshCtxPill();
    });
  }
  return aiSidebar;
}

function setSidebarView(next: SidebarView): void {
  sidebarView = next;
  const open = next !== null;

  aiPanel.classList.toggle('hidden', !open);
  aiDivider.classList.toggle('hidden', !open);
  gitContainer.classList.toggle('hidden', next !== 'git');
  aiContainer.classList.toggle('hidden', next !== 'ai');
  outlineContainer.classList.toggle('hidden', next !== 'outline');

  btnSidebarGit.classList.toggle('active', next === 'git');
  btnSidebarAi.classList.toggle('active', next === 'ai');
  btnSidebarOutline.classList.toggle('active', next === 'outline');

  if (next === 'ai') {
    ensureAiSidebar();
  } else if (aiSelectionListener) {
    aiSelectionListener.dispose();
    aiSelectionListener = null;
  }
  if (next === 'git') {
    void refreshGitPanels();
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
          title: '⚡ Fix error',
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

// "Optimize expression" context menu action (requires selection)
editor.addAction({
  id: 'ai.optimize',
  label: 'AI: Optimize expression',
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
  setSidebarView(sidebarView === 'outline' ? null : 'outline');
});

// divider drag
let aiDragging = false;

aiDivider.addEventListener('mousedown', e => {
  aiDragging = true;
  aiDivider.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (!aiDragging) return;
  const rect = workspace.getBoundingClientRect();
  const w = Math.max(260, Math.min(rect.right - e.clientX, 500));
  aiPanel.style.width = `${w}px`;
});

// settings
let settingsPanel: SettingsPanel | null = null;
let formatOnSave = initSettings.formatOnSave;

function ensureSettingsPanel(): SettingsPanel {
  if (settingsPanel) return settingsPanel;
  settingsPanel = new SettingsPanel(s => {
    formatOnSave = s.formatOnSave;
    applyGitAutofetch(s);
    applyTheme(s.colorTheme);
    applyUiFont(s.uiFontFamily);
    monaco.editor.setTheme(s.editorTheme);
    editor.updateOptions({
      fontSize:    s.fontSize,
      fontFamily:  s.codeFontFamily,
      lineNumbers: s.lineNumbers,
      minimap:     { enabled: s.minimap },
      wordWrap:    s.wordWrap,
    });
  });
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
  onOpen: hit => openPath(hit.path, { line: hit.line, col: hit.col }),
});

const baseCommands: PaletteCommand[] = [
  {
    id: 'file.new',
    label: 'New File',
    description: 'Clear the editor and start fresh',
    keybinding: '⌘N',
    action: () => cmdNew(),
  },
  {
    id: 'file.open',
    label: 'Open File…',
    description: 'Open a .dsmx file from disk',
    keybinding: '⌘O',
    action: () => cmdOpen(),
  },
  {
    id: 'file.save',
    label: 'Save File',
    description: 'Save the current DSL file',
    keybinding: '⌘S',
    action: () => cmdSave(),
  },
  {
    id: 'file.saveas',
    label: 'Save File As…',
    description: 'Save to a new location',
    action: () => cmdSave(true),
  },
  {
    id: 'graph.reset',
    label: 'Reset Graph',
    description: 'Clear all expressions from the graph',
    action: () => {
      graph.update([]);
      sourceMap = [];
      graphLink.reset();
      setStatus('Graph reset', 'info');
    },
  },
  {
    id: 'graph.export-image',
    label: 'Export as Image',
    description: 'Download the current graph as a PNG',
    action: async () => {
      try {
        const url = graph.screenshot();
        if (!url) { setStatus('Screenshot not available', 'error'); return; }
        const a = document.createElement('a');
        a.href = url;
        a.download = 'desmos-graph.png';
        a.click();
        setStatus('Graph exported as PNG', 'success');
      } catch {
        setStatus('Export failed', 'error');
      }
    },
  },
  {
    id: 'editor.format',
    label: 'Format Code',
    description: 'Auto-format the DSL source',
    keybinding: '⇧⌥F',
    action: () => runEditorAction('editor.action.formatDocument'),
  },
  {
    id: 'editor.find',
    label: 'Find',
    description: 'Open the find widget',
    keybinding: '⌘F',
    action: () => runEditorAction('actions.find'),
  },
  {
    id: 'editor.replace',
    label: 'Find & Replace',
    description: 'Open find & replace widget',
    keybinding: '⌘H',
    action: () => runEditorAction('editor.action.startFindReplaceAction'),
  },
  {
    id: 'mode.dsl',
    label: 'Switch to DSL Mode',
    description: 'Show only the DSL editor',
    action: () => setMode('dsl'),
  },
  {
    id: 'mode.split',
    label: 'Switch to Split Mode',
    description: 'Show DSL editor and Enhanced pane side by side',
    action: () => setMode('split'),
  },
  {
    id: 'mode.enhanced',
    label: 'Switch to Enhanced Mode',
    description: 'Edit the graph directly, bypassing the DSL — export as JSON to keep the edits',
    action: () => setMode('enhanced'),
  },
  {
    id: 'sidebar.git',
    label: 'Toggle Source Control Sidebar',
    description: 'Open or close the Git panel',
    action: () => setSidebarView(sidebarView === 'git' ? null : 'git'),
  },
  {
    id: 'sidebar.ai',
    label: 'Toggle AI Assistant Sidebar',
    description: 'Open or close the AI chat panel',
    action: () => setSidebarView(sidebarView === 'ai' ? null : 'ai'),
  },
  {
    id: 'sidebar.outline',
    label: 'Toggle Outline Sidebar',
    description: 'Open or close the symbol outline',
    action: () => setSidebarView(sidebarView === 'outline' ? null : 'outline'),
  },
  {
    id: 'compile.run',
    label: 'Recompile',
    description: 'Manually trigger a DSL recompile',
    action: () => { runCompile(); setStatus('Recompiling…', 'info'); },
  },
  {
    id: 'editor.rename',
    label: 'Rename Symbol (F2)',
    description: 'Rename the symbol under the cursor throughout the file',
    keybinding: 'F2',
    action: () => {
      editor.focus();
      void editor.getAction('editor.action.rename')?.run();
    },
  },
  {
    id: 'file.search',
    label: 'Search in Recent Files',
    description: 'Find text across the files you have opened',
    keybinding: '⇧⌘F',
    action: () => searchPanel.show(),
  },
];

function syncRecent(): void {
  refreshPaletteCommands();
  void window.electronAPI?.setRecentFiles(recentFiles.map(f => f.path));
}

// the recent files are commands too, so they are reachable without new chrome
function refreshPaletteCommands(): void {
  const paths = recentFiles.map(f => f.path);
  palette.register([
    ...baseCommands,
    ...recentFiles.map(f => {
      const { name, hint } = recentLabel(f.path, paths);
      return {
        id: `file.recent:${f.path}`,
        label: `Open Recent: ${name}`,
        description: hint || f.path,
        action: () => void openPath(f.path),
      };
    }),
  ]);
}

syncRecent();

// restores the last session before anything else touches the buffer
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
        // the file on disk wins: it may have changed since the app last ran
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
  runCompile();
}

void restoreSession();
void refreshGitStatus();
applyGitAutofetch(initSettings);
editor.focus();

window.addEventListener('beforeunload', () => {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistSession();
  searchPanel.dispose();
});
