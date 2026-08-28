
const missing: string[] = [];

function need<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) missing.push(id);
  return found as T;
}

export const DOM = {
  editorContainer: need('editor-container'),
  graphContainer:  need('graph-container'),
  graphIsland:     need('graph-island'),
  graphStale:      need('graph-stale'),
  transport:       need('transport'),

  dslPane:      need('dsl-pane'),
  enhancedPane: need('enhanced-pane'),
  paneDivider:  need('pane-divider'),
  exprList:     need('expr-list'),
  btnAddExpr:   need<HTMLButtonElement>('btn-add-expr'),
  enhancedUnsavedBar: need('enhanced-unsaved-bar'),
  btnExportJson: need<HTMLButtonElement>('btn-export-json'),

  btnDsl:      need<HTMLButtonElement>('btn-dsl'),
  btnSplit:    need<HTMLButtonElement>('btn-split'),
  btnEnhanced: need<HTMLButtonElement>('btn-enhanced'),
  modeToggle:  need('mode-toggle'),

  btnNew:  need<HTMLButtonElement>('btn-new'),
  btnOpen: need<HTMLButtonElement>('btn-open'),
  btnSave: need<HTMLButtonElement>('btn-save'),

  titlebar:   need('titlebar'),
  filename:   need('filename'),
  savedDot:   need('saved-dot'),
  statusbar:  need('statusbar'),
  statusMsg:  need('status-msg'),
  statusFacts: need('status-facts'),
  statusBranch: need('status-branch'),
  statusSave:   need('status-save'),
  statusPos:    need('status-pos'),
  statusPlugins: need('status-plugins'),
  statusGraphOnly: need('status-graph-only'),

  divider:      need('divider'),
  editorIsland: need('editor-island'),
  workspace:    need('upper-row'),
  centerCol:    need('center-col'),
  canvas:       need('canvas'),

  tabStrip:  need('tab-strip'),
  tabLabel:  need('tab-label'),
  tabDot:    need('tab-dot'),
  tabClose:  need<HTMLButtonElement>('tab-close'),
  fileTab:   need('file-tab'),
  pluginTab: need('plugin-tab'),
  pluginTabLabel: need('plugin-tab-label'),
  pluginTabClose: need<HTMLButtonElement>('plugin-tab-close'),
  pluginPage: need('plugin-page'),
  breadcrumbs: need('breadcrumbs'),

  projectWidget:  need<HTMLButtonElement>('project-widget'),
  branchWidget:   need<HTMLButtonElement>('branch-widget'),
  branchWidgetLbl: need('branch-widget-label'),
  searchWidget:   need<HTMLButtonElement>('search-widget'),

  railLeft:  need('rail-left'),
  railRight: need('rail-right'),

  toolLeft:        need('tool-left'),
  toolLeftDivider: need('tool-left-divider'),
  toolBottom:      need('tool-bottom'),
  bottomDivider:   need('bottom-divider'),

  btnToolProblems:  need<HTMLButtonElement>('btn-tool-problems'),
  btnToolTimeline:  need<HTMLButtonElement>('btn-tool-timeline'),
  btnToolOptimizer: need<HTMLButtonElement>('btn-tool-optimizer'),
  btnTabProblems:   need<HTMLButtonElement>('btn-tab-problems'),
  btnTabTimeline:   need<HTMLButtonElement>('btn-tab-timeline'),
  btnTabOptimizer:  need<HTMLButtonElement>('btn-tab-optimizer'),
  btnBottomClose:   need<HTMLButtonElement>('btn-tool-bottom-close'),

  problemsBody:  need('problems-body'),
  problemsList:  need('problems-list'),
  problemsEmpty: need('problems-empty'),
  problemsBadge: need('problems-badge'),
  problemsCount: need('problems-count'),
  timelineBody:  need('timeline-body'),
  timelineList:  need('timeline-list'),
  timelineEmpty: need('timeline-empty'),
  optimizerBody:  need('optimizer-body'),
  optimizerList:  need('optimizer-list'),
  optimizerEmpty: need('optimizer-empty'),
  optimizerCount: need('optimizer-count'),
  optimizerBadge: need('optimizer-badge'),

  btnSidebarGit:      need<HTMLButtonElement>('btn-sidebar-git'),
  btnSidebarAi:       need<HTMLButtonElement>('btn-sidebar-ai'),
  btnSidebarOutline:  need<HTMLButtonElement>('btn-sidebar-outline'),
  btnSidebarPlugins:  need<HTMLButtonElement>('btn-sidebar-plugins'),
  btnSidebarSettings: need<HTMLButtonElement>('btn-sidebar-settings'),

  gitContainer:     need('git-sidebar-container'),
  outlineContainer: need('outline-sidebar-container'),
  outlineList:      need('outline-list'),
  outlineEmpty:     need('outline-empty'),
  pluginsContainer: need('plugins-sidebar-container'),
  pluginsViews:     need('plugins-views'),
  pluginsSearch:    need<HTMLInputElement>('plugins-search'),
  pluginsInstalledList:  need('plugins-installed-list'),
  pluginsInstalledEmpty: need('plugins-installed-empty'),
  pluginsMarketList:     need('plugins-market-list'),
  pluginsMarketEmpty:    need('plugins-market-empty'),
  pluginsRefresh:        need<HTMLButtonElement>('plugins-refresh'),

  aiPanel:     need('ai-panel'),
  aiDivider:   need('ai-divider'),
  aiContainer: need('ai-sidebar-container'),

  startPage: need('start-page'),
} as const;

if (missing.length) {
  throw new Error(`index.html has no ${missing.map(id => `#${id}`).join(', ')}`);
}
