import { DOM } from './dom';
import type { Layout } from '../layout';
import {
  loadLayout, saveLayout,
  type BottomTab, type LayoutState, type LeftView, type MaximizedPane,
} from './layout-store';
import type { Mode } from '../session';

export type SidebarView = LeftView | 'ai' | null;
export type { BottomTab, LeftView, MaximizedPane };

export interface WorkbenchOptions {
  layout: Layout;
  relayout: () => void;
  onMode: (mode: Mode) => void;
  onLeftView: (view: LeftView | null) => void;
  onAi: (open: boolean) => void;
  onBottomTab: (tab: BottomTab) => void;
}

const FIT = { editor: 280, graph: 204, left: 180, ai: 260, divider: 6 };

const BOTTOM_PARTS: Record<BottomTab, { body: HTMLElement; tab: HTMLButtonElement; rail: HTMLButtonElement }> = {
  problems:  { body: DOM.problemsBody,  tab: DOM.btnTabProblems,  rail: DOM.btnToolProblems },
  timeline:  { body: DOM.timelineBody,  tab: DOM.btnTabTimeline,  rail: DOM.btnToolTimeline },
  optimizer: { body: DOM.optimizerBody, tab: DOM.btnTabOptimizer, rail: DOM.btnToolOptimizer },
};

export class Workbench {
  private state: LayoutState = loadLayout();
  private mode: Mode = 'dsl';
  private activeTab: 'file' | 'plugin' = 'file';
  private empty = false;
  private simple = false;
  private narrow = { left: false, ai: false };
  private lastOpened: 'left' | 'ai' | null = null;

  constructor(private readonly opts: WorkbenchOptions) {}

  restore(): void {
    this.opts.layout.apply(this.state.sizes);
    if (this.state.leftView) this.setSidebarView(this.state.leftView);
    if (this.state.aiOpen) this.setSidebarView('ai');
    this.setBottomTab(this.state.bottomTab);
    this.setBottomOpen(this.state.bottomOpen);
    if (this.state.maximized) this.setMaximized(this.state.maximized);
  }

  private persist(): void {
    saveLayout(this.state);
  }

  noteResize(): void {
    this.state.sizes = this.opts.layout.sizes();
    this.persist();
  }

  get currentMode(): Mode { return this.mode; }
  get tab(): 'file' | 'plugin' { return this.activeTab; }
  get leftView(): LeftView | null { return this.state.leftView; }
  get aiOpen(): boolean { return this.state.aiOpen; }
  get sidebarView(): SidebarView { return this.state.aiOpen ? 'ai' : this.state.leftView; }
  get bottomTab(): BottomTab { return this.state.bottomTab; }
  get bottomOpen(): boolean { return this.state.bottomOpen; }
  get maximized(): MaximizedPane | null { return this.state.maximized; }
  get isEmpty(): boolean { return this.empty; }

  setMode(mode: Mode): void {
    this.mode = mode;
    DOM.btnDsl.classList.toggle('active', mode === 'dsl');
    DOM.btnSplit.classList.toggle('active', mode === 'split');
    DOM.btnEnhanced.classList.toggle('active', mode === 'enhanced');
    this.opts.onMode(mode);

    if (this.activeTab === 'plugin') return;
    const showDsl = mode === 'dsl' || mode === 'split';
    const showEnhanced = mode === 'enhanced' || mode === 'split';

    DOM.dslPane.classList.toggle('hidden', !showDsl);
    DOM.dslPane.classList.toggle('split', mode === 'split');
    DOM.enhancedPane.classList.toggle('hidden', !showEnhanced);
    DOM.enhancedPane.classList.toggle('split', mode === 'split');
    DOM.paneDivider.classList.toggle('hidden', mode !== 'split');
    if (mode !== 'split') { DOM.dslPane.style.height = ''; DOM.dslPane.style.flex = ''; }
    if (showDsl) this.opts.relayout();
  }

  setActiveTab(tab: 'file' | 'plugin'): void {
    this.activeTab = tab;
    const onFile = tab === 'file';
    DOM.fileTab.classList.toggle('tab--active', onFile);
    DOM.fileTab.setAttribute('aria-selected', String(onFile));
    DOM.pluginTab.classList.toggle('tab--active', !onFile);
    DOM.pluginTab.setAttribute('aria-selected', String(!onFile));
    DOM.pluginPage.classList.toggle('hidden', onFile);

    if (onFile) { this.setMode(this.mode); return; }
    DOM.dslPane.classList.add('hidden');
    DOM.enhancedPane.classList.add('hidden');
    DOM.paneDivider.classList.add('hidden');
  }

  setSidebarView(next: SidebarView): void {
    if (next === 'ai') {
      this.state.aiOpen = true;
      this.lastOpened = 'ai';
    } else {
      this.state.aiOpen = false;
      this.state.leftView = next;
      if (next !== null) this.lastOpened = 'left';
    }

    this.narrow = { left: false, ai: false };
    this.applySidebar();
    this.fitToWidth();
  }

  private applySidebar(): void {
    const leftOpen = this.state.leftView !== null && !this.narrow.left;
    const aiOpen = this.state.aiOpen && !this.narrow.ai;

    DOM.toolLeft.classList.toggle('hidden', !leftOpen);
    DOM.toolLeftDivider.classList.toggle('hidden', !leftOpen);
    DOM.gitContainer.classList.toggle('hidden', this.state.leftView !== 'git');
    DOM.outlineContainer.classList.toggle('hidden', this.state.leftView !== 'outline');
    DOM.pluginsContainer.classList.toggle('hidden', this.state.leftView !== 'plugins');

    DOM.aiPanel.classList.toggle('hidden', !aiOpen);
    DOM.aiDivider.classList.toggle('hidden', !aiOpen);
    DOM.aiContainer.classList.toggle('hidden', !aiOpen);

    const rail = (button: HTMLElement, on: boolean) => {
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-expanded', String(on));
    };
    rail(DOM.btnSidebarGit, this.state.leftView === 'git');
    rail(DOM.btnSidebarOutline, this.state.leftView === 'outline');
    rail(DOM.btnSidebarPlugins, this.state.leftView === 'plugins');
    rail(DOM.btnSidebarAi, this.state.aiOpen);

    this.persist();
    this.opts.onLeftView(leftOpen ? this.state.leftView : null);
    this.opts.onAi(aiOpen);
    this.opts.relayout();
  }

  fitToWidth(): void {
    const room = DOM.workspace.getBoundingClientRect().width;
    if (room <= 0) return;

    let left = this.state.leftView !== null;
    let ai = this.state.aiOpen;
    const needed = () => FIT.editor + FIT.graph + FIT.divider
      + (left ? FIT.left + FIT.divider : 0)
      + (ai ? FIT.ai + FIT.divider : 0);

    for (const drop of this.lastOpened === 'left' ? ['ai', 'left'] : ['left', 'ai']) {
      if (needed() <= room) break;
      if (drop === 'ai') ai = false; else left = false;
    }

    const next = { left: this.state.leftView !== null && !left, ai: this.state.aiOpen && !ai };
    if (next.left === this.narrow.left && next.ai === this.narrow.ai) return;
    this.narrow = next;
    this.applySidebar();
  }

  toggleSidebar(view: NonNullable<SidebarView>): void {
    if (view === 'ai') this.setSidebarView(this.state.aiOpen ? null : 'ai');
    else this.setSidebarView(this.state.leftView === view ? null : view);
  }

  setBottomTab(tab: BottomTab): void {
    this.state.bottomTab = tab;
    for (const [name, parts] of Object.entries(BOTTOM_PARTS) as [BottomTab, typeof BOTTOM_PARTS[BottomTab]][]) {
      const on = name === tab;
      parts.body.classList.toggle('hidden', !on);
      parts.tab.classList.toggle('tool-tab--active', on);
      parts.tab.setAttribute('aria-selected', String(on));
    }
    this.syncRail();
    this.persist();
    this.opts.onBottomTab(tab);
  }

  setBottomOpen(open: boolean, tab?: BottomTab): void {
    this.state.bottomOpen = open;
    DOM.toolBottom.classList.toggle('hidden', !open);
    DOM.bottomDivider.classList.toggle('hidden', !open);
    if (open && tab) this.setBottomTab(tab);
    this.syncRail();
    this.persist();
    this.opts.relayout();
  }

  toggleBottom(tab: BottomTab): void {
    if (this.state.bottomOpen && this.state.bottomTab === tab) this.setBottomOpen(false);
    else this.setBottomOpen(true, tab);
  }

  private syncRail(): void {
    for (const [name, parts] of Object.entries(BOTTOM_PARTS) as [BottomTab, typeof BOTTOM_PARTS[BottomTab]][]) {
      const on = this.state.bottomOpen && this.state.bottomTab === name;
      parts.rail.classList.toggle('active', on);
      parts.rail.setAttribute('aria-pressed', String(on));
      parts.rail.setAttribute('aria-expanded', String(on));
    }
  }

  setMaximized(pane: MaximizedPane | null): void {
    this.state.maximized = pane;
    DOM.editorIsland.classList.toggle('hidden', pane === 'graph');
    DOM.graphIsland.classList.toggle('hidden', pane === 'editor');
    DOM.divider.classList.toggle('hidden', pane !== null);
    this.persist();
    this.opts.relayout();
  }

  toggleMaximized(pane: MaximizedPane): void {
    this.setMaximized(this.state.maximized === pane ? null : pane);
  }

  resetLayout(): void {
    this.opts.layout.reset();
    this.setMaximized(null);
    this.state.sizes = {};
    this.persist();
  }

  setEmpty(empty: boolean): void {
    if (this.empty === empty) return;
    this.empty = empty;
    document.documentElement.toggleAttribute('data-empty', empty);
    DOM.startPage.classList.toggle('hidden', !empty);
    DOM.centerCol.classList.toggle('hidden', empty);
    DOM.railLeft.classList.toggle('hidden', empty);
    DOM.railRight.classList.toggle('hidden', empty);
    if (!empty) this.opts.relayout();
  }

  setSimple(simple: boolean): void {
    this.simple = simple;
    document.documentElement.toggleAttribute('data-simple', simple);
    if (simple) {
      this.setSidebarView(null);
      this.setBottomOpen(false);
    }
    this.opts.relayout();
  }

  get isSimple(): boolean { return this.simple; }
}
