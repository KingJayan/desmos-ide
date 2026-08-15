// keeps the graph selection and the editor cursor pointing at the same thing

import type { ExprSource } from '../src/index';

export function lineForId(map: ExprSource[], id: string): ExprSource | null {
  return map.find(e => e.id === id) ?? null;
}

export function idForLine(map: ExprSource[], line: number): string | null {
  let best: ExprSource | null = null;
  for (const e of map) {
    if (e.line > line) continue;
    if (!best || e.line > best.line) best = e;
  }
  return best?.id ?? null;
}

export interface GraphLinkPorts {
  sourceMap: () => ExprSource[];
  revealLine: (line: number, col: number) => void;
  highlightLine: (line: number | null) => void;
  selectOnGraph: (id: string | null) => void;
}

export class GraphLink {
  private lastId: string | null = null;
  private suppress = false;

  constructor(private ports: GraphLinkPorts) {}

  /** graph selection changed */
  onGraphSelected(id: string | null): void {
    if (this.suppress || id === this.lastId) return;
    this.lastId = id;

    if (!id) {
      this.ports.highlightLine(null);
      return;
    }
    const at = lineForId(this.ports.sourceMap(), id);
    if (!at) {
      this.ports.highlightLine(null);
      return;
    }
    this.suppress = true;
    try {
      this.ports.revealLine(at.line, at.col);
      this.ports.highlightLine(at.line);
    } finally {
      this.suppress = false;
    }
  }

  /** cursor moved */
  onCursorMoved(line: number): void {
    if (this.suppress) return;
    const id = idForLine(this.ports.sourceMap(), line);
    if (id === this.lastId) return;
    this.lastId = id;
    this.suppress = true;
    try {
      this.ports.selectOnGraph(id);
      this.ports.highlightLine(id ? line : null);
    } finally {
      this.suppress = false;
    }
  }

  reset(): void {
    this.lastId = null;
    this.ports.highlightLine(null);
  }
}
