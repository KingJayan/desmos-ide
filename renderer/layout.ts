import type { DividerName } from './modules/layout-store';

export interface Panes {
  editorIsland: HTMLElement;
  workspace: HTMLElement;
  centerCol: HTMLElement;
  dslPane: HTMLElement;
  toolLeft: HTMLElement;
  toolBottom: HTMLElement;
  aiPanel: HTMLElement;
}

export type Handles = Record<DividerName, HTMLElement>;

interface Divider {
  name: DividerName;
  handle: HTMLElement;
  axis: 'v' | 'h';
  label: string;
  read: () => number;
  write: (px: number) => void;
  clear: () => void;
  fromPointer: (e: MouseEvent) => number;

  grows: 'right' | 'left' | 'up' | 'down';
  relayout: boolean;
}

const LIMITS = {
  editorMin: 280,
  graphMin: 204,
  paneMin: 80,
  paneRoom: 84,
  toolLeftMin: 180,
  toolLeftMax: 520,
  bottomMin: 90,
  bottomRoom: 140,
  aiMin: 260,
  aiMax: 500,
};

const STEP = 16;
const BIG_STEP = 64;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(value, high));

export class Layout {
  private readonly dividers: Divider[];
  private readonly byName = new Map<DividerName, Divider>();
  private readonly collapsedFrom = new Map<DividerName, number>();
  private active: Divider | null = null;

  private readonly onDown = (divider: Divider) => (e: MouseEvent) => {
    this.active = divider;
    divider.handle.classList.add('dragging');
    e.preventDefault();
  };

  private readonly onMove = (e: MouseEvent) => {
    if (!this.active) return;
    this.active.write(this.active.fromPointer(e));
    if (this.active.relayout) this.relayout();
  };

  private readonly onUp = () => {
    if (!this.active) return;
    this.active.handle.classList.remove('dragging');
    this.active = null;
    this.onResize();
  };

  constructor(
    handles: Handles,
    panes: Panes,
    private readonly relayout: () => void,
    private readonly onResize: () => void = () => {},
  ) {
    this.dividers = [
      {
        name: 'editor', handle: handles.editor, axis: 'v', label: 'editor and graph', relayout: true,
        grows: 'right',
        read: () => panes.editorIsland.getBoundingClientRect().width,
        write: px => {
          const rect = panes.editorIsland.getBoundingClientRect();
          const room = panes.workspace.getBoundingClientRect().right - rect.left;
          panes.editorIsland.style.width = `${clamp(px, LIMITS.editorMin, Math.max(LIMITS.editorMin, room - LIMITS.graphMin))}px`;
        },
        clear: () => { panes.editorIsland.style.width = ''; },
        fromPointer: e => e.clientX - panes.editorIsland.getBoundingClientRect().left,
      },
      {
        name: 'pane', handle: handles.pane, axis: 'h', label: 'dsl and expression list', relayout: true,
        grows: 'down',
        read: () => panes.dslPane.getBoundingClientRect().height,
        write: px => {
          const rect = panes.editorIsland.getBoundingClientRect();
          panes.dslPane.style.flex = 'none';
          panes.dslPane.style.height = `${clamp(px, LIMITS.paneMin, Math.max(LIMITS.paneMin, rect.height - LIMITS.paneRoom))}px`;
        },
        clear: () => { panes.dslPane.style.height = ''; panes.dslPane.style.flex = ''; },
        fromPointer: e => e.clientY - panes.editorIsland.getBoundingClientRect().top,
      },
      {
        name: 'toolLeft', handle: handles.toolLeft, axis: 'v', label: 'left tool window', relayout: true,
        grows: 'right',
        read: () => panes.toolLeft.getBoundingClientRect().width,
        write: px => {
          panes.toolLeft.style.width = `${clamp(px, LIMITS.toolLeftMin, LIMITS.toolLeftMax)}px`;
        },
        clear: () => { panes.toolLeft.style.width = ''; },
        fromPointer: e => e.clientX - panes.toolLeft.getBoundingClientRect().left,
      },
      {
        name: 'bottom', handle: handles.bottom, axis: 'h', label: 'bottom tool window', relayout: true,
        grows: 'up',
        read: () => panes.toolBottom.getBoundingClientRect().height,
        write: px => {
          const rect = panes.centerCol.getBoundingClientRect();
          panes.toolBottom.style.height = `${clamp(px, LIMITS.bottomMin, Math.max(LIMITS.bottomMin, rect.height - LIMITS.bottomRoom))}px`;
        },
        clear: () => { panes.toolBottom.style.height = ''; },
        fromPointer: e => panes.centerCol.getBoundingClientRect().bottom - e.clientY,
      },
      {
        name: 'ai', handle: handles.ai, axis: 'v', label: 'ai panel', relayout: false,
        grows: 'left',
        read: () => panes.aiPanel.getBoundingClientRect().width,
        write: px => {
          panes.aiPanel.style.width = `${clamp(px, LIMITS.aiMin, LIMITS.aiMax)}px`;
        },
        clear: () => { panes.aiPanel.style.width = ''; },
        fromPointer: e => panes.workspace.getBoundingClientRect().right - e.clientX,
      },
    ];

    for (const divider of this.dividers) {
      this.byName.set(divider.name, divider);
      divider.handle.setAttribute('role', 'separator');
      divider.handle.setAttribute('tabindex', '0');
      divider.handle.setAttribute('aria-orientation', divider.axis === 'v' ? 'vertical' : 'horizontal');
      divider.handle.setAttribute('aria-label', `resize ${divider.label}`);
      divider.handle.addEventListener('mousedown', this.onDown(divider));
      divider.handle.addEventListener('dblclick', () => this.toggleCollapse(divider));
      divider.handle.addEventListener('keydown', e => this.onKey(divider, e));
    }
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onUp);
  }

  private onKey(divider: Divider, e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.toggleCollapse(divider);
      return;
    }
    const step = e.shiftKey ? BIG_STEP : STEP;
    const towards: Record<string, string> = {
      ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down',
    };
    const direction = towards[e.key];
    if (!direction) return;
    const wanted = divider.axis === 'v' ? ['right', 'left'] : ['up', 'down'];
    if (!wanted.includes(direction)) return;
    e.preventDefault();
    divider.write(divider.read() + (direction === divider.grows ? step : -step));
    if (divider.relayout) this.relayout();
    this.onResize();
  }

  private toggleCollapse(divider: Divider): void {
    const held = this.collapsedFrom.get(divider.name);
    if (held === undefined) {
      this.collapsedFrom.set(divider.name, divider.read());
      divider.write(0);
    } else {
      this.collapsedFrom.delete(divider.name);
      divider.write(held);
    }
    if (divider.relayout) this.relayout();
    this.onResize();
  }

  sizes(): Partial<Record<DividerName, number>> {
    const out: Partial<Record<DividerName, number>> = {};
    for (const divider of this.dividers) {
      const size = Math.round(divider.read());
      if (size > 0) out[divider.name] = size;
    }
    return out;
  }

  apply(sizes: Partial<Record<DividerName, number>>): void {
    for (const [name, size] of Object.entries(sizes)) {
      if (typeof size === 'number') this.byName.get(name as DividerName)?.write(size);
    }
    this.relayout();
  }

  reset(): void {
    this.collapsedFrom.clear();
    for (const divider of this.dividers) divider.clear();
    this.relayout();
    this.onResize();
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onUp);
    this.active = null;
  }
}
