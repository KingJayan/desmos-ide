import type { OptimizeNote } from '../src/index';

export interface OptimizerGroup {
  line: number;
  notes: OptimizeNote[];
}

/** one group per source line, lines in order, notes innermost first inside a line */
export function groupByLine(notes: OptimizeNote[]): OptimizerGroup[] {
  const byLine = new Map<number, OptimizeNote[]>();
  for (const note of notes) {
    const bucket = byLine.get(note.line);
    if (bucket) bucket.push(note);
    else byLine.set(note.line, [note]);
  }
  return [...byLine.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([line, group]) => ({ line, notes: group }));
}

/**
 * the editor hint for a line. the optimizer rewrites children before parents, so
 * the last note on a line is the outermost one, and that is the result the line
 * really compiles to
 */
export function lineHint(group: OptimizerGroup): string {
  const outer = group.notes[group.notes.length - 1]!;
  if (outer.kind === 'drop') return `⟶ ${outer.after}`;
  const more = group.notes.length - 1;
  return more > 0 ? `⟶ ${outer.after}  +${more}` : `⟶ ${outer.after}`;
}

export interface OptimizerPanelHost {
  list: HTMLElement;
  empty: HTMLElement;
  count: HTMLElement;
  badge: HTMLElement;
  jump(line: number): void;
}

export class OptimizerPanel {
  constructor(private host: OptimizerPanelHost) {}

  render(notes: OptimizeNote[]): void {
    const { list, empty, count, badge } = this.host;
    list.replaceChildren();
    empty.classList.toggle('hidden', notes.length > 0);

    const label = String(notes.length);
    count.textContent = label;
    badge.textContent = label;
    count.classList.toggle('hidden', notes.length === 0);
    badge.classList.toggle('hidden', notes.length === 0);

    for (const group of groupByLine(notes)) {
      for (const note of group.notes) {
        const li = document.createElement('li');
        li.className = 'optimizer-row';
        li.tabIndex = 0;
        li.setAttribute('role', 'button');

        const kind = document.createElement('span');
        kind.className = `optimizer-kind optimizer-kind--${note.kind}`;
        kind.textContent = note.kind;

        const before = document.createElement('code');
        before.className = 'optimizer-before';
        before.textContent = note.before;

        const arrow = document.createElement('span');
        arrow.className = 'optimizer-arrow';
        arrow.textContent = '⟶';

        const after = document.createElement('code');
        after.className = 'optimizer-after';
        after.textContent = note.after;

        const loc = document.createElement('span');
        loc.className = 'optimizer-loc';
        loc.textContent = `${note.line}:${note.col}`;

        li.append(kind, before, arrow, after, loc);

        const jump = () => this.host.jump(note.line);
        li.addEventListener('click', jump);
        li.addEventListener('keydown', e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          jump();
        });
        list.appendChild(li);
      }
    }
  }
}
