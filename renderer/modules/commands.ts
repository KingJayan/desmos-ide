import type { PaletteCommand } from '../command-palette';

export interface AppCommandHooks {
  newFile: () => void | Promise<void>;
  openFile: () => void | Promise<void>;
  openFolder: () => void | Promise<void>;
  closeFile: () => void | Promise<void>;
  save: (saveAs?: boolean) => void | Promise<void>;
  exportTex: () => void | Promise<void>;
  exportImage: (format: 'png' | 'svg') => void | Promise<void>;
  copyShareLink: () => void | Promise<void>;
  openShareLink: () => void | Promise<void>;
  openExample: () => void;
  resetGraph: () => void;
  recompile: () => void;
  editorAction: (id: string) => void;
  findWithRegex: () => void;
  setMode: (mode: 'dsl' | 'split' | 'enhanced') => void;
  toggleSidebar: (view: 'git' | 'outline' | 'plugins' | 'ai') => void;
  toggleLeftPanel: () => void;
  toggleBottom: (tab: 'problems' | 'timeline' | 'optimizer') => void;
  toggleBottomPanel: () => void;
  maximize: (pane: 'editor' | 'graph') => void;
  resetLayout: () => void;
  toggleSimple: () => void;
  showStartPage: () => void;
  search: () => void;
  palette: () => void;
  settings: () => void;
  openConfig: (file: 'settings' | 'keybinds') => void;
  resetKeybinds: () => void;
  exportSettings: () => void;
  importSettings: () => void;
  tour: () => void;
}

export function appCommands(hooks: AppCommandHooks): PaletteCommand[] {
  return [
    { id: 'file.new', label: 'new file', description: 'Start an empty buffer', action: () => hooks.newFile() },
    { id: 'file.open', label: 'open file…', description: 'Open a .dsmx file from disk', action: () => hooks.openFile() },
    {
      id: 'workspace.open-folder', label: 'open folder…',
      description: 'Give the app a folder, and list the .dsmx files in it',
      action: () => hooks.openFolder(),
    },
    { id: 'file.close', label: 'close file', description: 'Put the graph away and go back to the start page', action: () => hooks.closeFile() },
    { id: 'file.save', label: 'save file', description: 'Save the current DSL file', action: () => hooks.save() },
    { id: 'file.saveas', label: 'save file as…', description: 'Save to a new location', action: () => hooks.save(true) },
    {
      id: 'file.example', label: 'open the example file',
      description: 'A short file that shows what the language can do',
      action: () => hooks.openExample(),
    },
    {
      id: 'file.exporttex', label: 'export tex figure…',
      description: 'Write the graph as a standalone pgfplots document',
      action: () => hooks.exportTex(),
    },
    {
      id: 'graph.reset', label: 'reset graph',
      description: 'Clear all expressions from the graph',
      action: () => hooks.resetGraph(),
    },
    {
      id: 'share.copy', label: 'copy share link',
      description: 'A link that carries this file, so the reader gets the graph and the source',
      action: () => hooks.copyShareLink(),
    },
    { id: 'share.open', label: 'open share link', description: 'Preview the share link in your browser', action: () => hooks.openShareLink() },
    {
      id: 'graph.export-png', label: 'export png…',
      description: 'Write the graph as it looks now to a PNG file',
      action: () => hooks.exportImage('png'),
    },
    {
      id: 'graph.export-svg', label: 'export svg…',
      description: 'Write the graph as vector art that stays sharp at any size',
      action: () => hooks.exportImage('svg'),
    },
    {
      id: 'editor.format', label: 'format code', description: 'Auto-format the DSL source',
      keybinding: '⇧⌥F', action: () => hooks.editorAction('editor.action.formatDocument'),
    },
    { id: 'editor.find', label: 'find', description: 'Open the find widget', action: () => hooks.editorAction('actions.find') },
    {
      id: 'editor.replace', label: 'find & replace', description: 'Open find & replace widget',
      action: () => hooks.editorAction('editor.action.startFindReplaceAction'),
    },
    {
      id: 'editor.find-regex', label: 'find with a regular expression',
      description: 'Open the find widget with regex matching already on',
      action: () => hooks.findWithRegex(),
    },
    {
      id: 'editor.rename', label: 'rename symbol (f2)',
      description: 'Rename the symbol under the cursor throughout the file',
      keybinding: 'F2', action: () => hooks.editorAction('editor.action.rename'),
    },
    { id: 'mode.dsl', label: 'switch to dsl mode', description: 'Show only the DSL editor', action: () => hooks.setMode('dsl') },
    {
      id: 'mode.split', label: 'switch to split mode',
      description: 'Show DSL editor and Enhanced pane side by side', action: () => hooks.setMode('split'),
    },
    {
      id: 'mode.enhanced', label: 'switch to enhanced mode',
      description: 'Edit the expressions the way Desmos does — every edit goes back into the DSL',
      action: () => hooks.setMode('enhanced'),
    },
    { id: 'sidebar.git', label: 'toggle source control sidebar', description: 'Open or close the Git panel', action: () => hooks.toggleSidebar('git') },
    { id: 'sidebar.ai', label: 'toggle ai assistant sidebar', description: 'Open or close the AI chat panel', action: () => hooks.toggleSidebar('ai') },
    { id: 'sidebar.outline', label: 'toggle outline sidebar', description: 'Open or close the symbol outline', action: () => hooks.toggleSidebar('outline') },
    {
      id: 'sidebar.plugins', label: 'toggle plugins sidebar',
      description: 'Manage what is installed, and browse the marketplace', action: () => hooks.toggleSidebar('plugins'),
    },
    { id: 'panel.left', label: 'toggle the left panel', description: 'Show or hide the left tool window, whichever view it holds', action: () => hooks.toggleLeftPanel() },
    { id: 'panel.bottom', label: 'toggle the bottom panel', description: 'Show or hide the bottom tool window', action: () => hooks.toggleBottomPanel() },
    { id: 'tool.problems', label: 'toggle problems panel', description: 'Open or close the list of compile errors', action: () => hooks.toggleBottom('problems') },
    { id: 'tool.timeline', label: 'toggle timeline panel', description: 'Open or close the record of what the session did', action: () => hooks.toggleBottom('timeline') },
    { id: 'tool.optimizer', label: 'show optimizer report', description: 'List every fold, inline and drop the compiler made', action: () => hooks.toggleBottom('optimizer') },
    {
      id: 'layout.maximize-editor', label: 'maximize the editor',
      description: 'Give the editor the whole window, and put the graph away',
      action: () => hooks.maximize('editor'),
    },
    {
      id: 'layout.maximize-graph', label: 'maximize the graph',
      description: 'Give the graph the whole window, and put the editor away',
      action: () => hooks.maximize('graph'),
    },
    { id: 'layout.reset', label: 'reset the layout', description: 'Put every divider and panel back where it started', action: () => hooks.resetLayout() },
    {
      id: 'view.simple', label: 'toggle simple mode',
      description: 'Hide the rails, the panels and the status facts, leaving the editor and the graph',
      action: () => hooks.toggleSimple(),
    },
    { id: 'view.start-page', label: 'show the start page', description: 'The page the app opens on', action: () => hooks.showStartPage() },
    { id: 'compile.run', label: 'recompile', description: 'Manually trigger a DSL recompile', action: () => hooks.recompile() },
    { id: 'file.search', label: 'search in recent files', description: 'Find text across the files you have opened', action: () => hooks.search() },
    { id: 'palette.toggle', label: 'show all commands', description: 'Open or close this palette', action: () => hooks.palette() },
    { id: 'preferences.open', label: 'preferences: open settings', description: 'The settings dialog', action: () => hooks.settings() },
    {
      id: 'preferences.settings-json', label: 'preferences: open settings.json',
      description: 'Edit every setting as text — this file is what the app reads',
      action: () => hooks.openConfig('settings'),
    },
    {
      id: 'preferences.keybinds-json', label: 'preferences: open keybinds.json',
      description: 'Bind your own keys to any command in this palette',
      action: () => hooks.openConfig('keybinds'),
    },
    {
      id: 'preferences.reset-keybinds', label: 'preferences: reset keybinds',
      description: 'Write the default keys back into keybinds.json', action: () => hooks.resetKeybinds(),
    },
    {
      id: 'preferences.export', label: 'preferences: export settings…',
      description: 'Write the current settings to a JSON file you can carry', action: () => hooks.exportSettings(),
    },
    { id: 'preferences.import', label: 'preferences: import settings…', description: 'Read settings back from a JSON file', action: () => hooks.importSettings() },
    { id: 'help.tour', label: 'help: run the welcome tour', description: 'Point out the editor, the graph and the palette again', action: () => hooks.tour() },
  ];
}
