export interface Panes {
  editorIsland: HTMLElement;
  workspace: HTMLElement;
  centerCol: HTMLElement;
  dslPane: HTMLElement;
  toolLeft: HTMLElement;
  toolBottom: HTMLElement;
  aiPanel: HTMLElement;
}

export interface Handles {
  editor: HTMLElement;
  pane: HTMLElement;
  toolLeft: HTMLElement;
  bottom: HTMLElement;
  ai: HTMLElement;
}

interface Divider {
  handle: HTMLElement;
  drag: (e: MouseEvent) => void;
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

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(value, high));

export class Layout {
  private dividers: Divider[];
  private active: Divider | null = null;

  private readonly onDown = (divider: Divider) => (e: MouseEvent) => {
    this.active = divider;
    divider.handle.classList.add('dragging');
    e.preventDefault();
  };

  private readonly onMove = (e: MouseEvent) => {
    if (!this.active) return;
    this.active.drag(e);
    if (this.active.relayout) this.relayout();
  };

  private readonly onUp = () => {
    if (!this.active) return;
    this.active.handle.classList.remove('dragging');
    this.active = null;
  };

  constructor(
    handles: Handles,
    private readonly panes: Panes,
    private readonly relayout: () => void,
  ) {
    this.dividers = [
      { handle: handles.editor, relayout: true, drag: e => this.dragEditor(e) },
      { handle: handles.pane, relayout: true, drag: e => this.dragPane(e) },
      { handle: handles.toolLeft, relayout: true, drag: e => this.dragToolLeft(e) },
      { handle: handles.bottom, relayout: true, drag: e => this.dragBottom(e) },
      { handle: handles.ai, relayout: false, drag: e => this.dragAi(e) },
    ];

    for (const divider of this.dividers) {
      divider.handle.addEventListener('mousedown', this.onDown(divider));
    }
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onUp);
  }

  private dragEditor(e: MouseEvent): void {
    const rect = this.panes.editorIsland.getBoundingClientRect();
    const room = this.panes.workspace.getBoundingClientRect().right - rect.left;
    const width = clamp(e.clientX - rect.left, LIMITS.editorMin, room - LIMITS.graphMin);
    this.panes.editorIsland.style.width = `${width}px`;
  }

  private dragPane(e: MouseEvent): void {
    const rect = this.panes.editorIsland.getBoundingClientRect();
    const height = clamp(e.clientY - rect.top, LIMITS.paneMin, rect.height - LIMITS.paneRoom);
    this.panes.dslPane.style.flex = 'none';
    this.panes.dslPane.style.height = `${height}px`;
  }

  private dragToolLeft(e: MouseEvent): void {
    const rect = this.panes.toolLeft.getBoundingClientRect();
    const width = clamp(e.clientX - rect.left, LIMITS.toolLeftMin, LIMITS.toolLeftMax);
    this.panes.toolLeft.style.width = `${width}px`;
  }

  private dragBottom(e: MouseEvent): void {
    const rect = this.panes.centerCol.getBoundingClientRect();
    const height = clamp(rect.bottom - e.clientY, LIMITS.bottomMin, rect.height - LIMITS.bottomRoom);
    this.panes.toolBottom.style.height = `${height}px`;
  }

  private dragAi(e: MouseEvent): void {
    const rect = this.panes.workspace.getBoundingClientRect();
    const width = clamp(rect.right - e.clientX, LIMITS.aiMin, LIMITS.aiMax);
    this.panes.aiPanel.style.width = `${width}px`;
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onUp);
    this.active = null;
  }
}
