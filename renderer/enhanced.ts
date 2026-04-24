import type { DesmosExpr } from '../src/compiler/codegen';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const PALETTE = ['#2d70b3', '#c74440', '#388c46', '#6042a6', '#fa7e19', '#000000'];

function renderLatex(latex: string, container: HTMLElement): void {
  if (!latex.trim()) {
    container.innerHTML = '<span class="expr-math-placeholder">LaTeX…</span>';
    return;
  }
  try {
    katex.render(latex, container, {
      throwOnError: false,
      displayMode: false,
      output: 'html',
      trust: false,
    });
  } catch {
    container.textContent = latex;
  }
}

export class EnhancedPane {
  private list: DesmosExpr[] = [];
  private nextId = 1000;
  private dirty = false;
  private editingId: string | null = null;

  constructor(
    private listEl: HTMLElement,
    addBtn: HTMLButtonElement,
    private onChange: (list: DesmosExpr[], dirty: boolean) => void,
  ) {
    addBtn.addEventListener('click', () => this.addRow());
  }

  get isDirty(): boolean { return this.dirty; }

  clearDirty(): void { this.dirty = false; }

  getList(): DesmosExpr[] { return [...this.list]; }

  syncFromGraph(graphList: DesmosExpr[]): void {
    this.list = graphList
      .filter(e => e.type === 'expression')
      .map(e => ({ ...e }));
    this.dirty = false;
    this.editingId = null;
    this.render();
  }

  private addRow(): void {
    const id = String(this.nextId++);
    this.list.push({ type: 'expression', id, latex: '', color: PALETTE[0] });
    this.dirty = true;
    this.editingId = id;
    this.render();
    const row = this.listEl.querySelector<HTMLElement>(`[data-id="${id}"]`);
    row?.querySelector<HTMLInputElement>('.expr-input')?.focus();
    this.onChange([...this.list], true);
  }

  private removeRow(id: string): void {
    this.list = this.list.filter(e => e.id !== id);
    this.dirty = true;
    if (this.editingId === id) this.editingId = null;
    this.render();
    this.onChange([...this.list], true);
  }

  private patchLatex(id: string, latex: string): void {
    const expr = this.list.find(e => e.id === id);
    if (expr) {
      expr.latex = latex;
      this.dirty = true;
      this.onChange([...this.list], true);
    }
  }

  private commitEdit(id: string, value: string): void {
    this.patchLatex(id, value);
    this.editingId = null;
    this.render();
  }

  private render(): void {
    this.listEl.innerHTML = '';
    for (const expr of this.list) {
      const row = document.createElement('div');
      row.className = 'expr-row';
      row.dataset.id = expr.id;

      const dot = document.createElement('span');
      dot.className = 'expr-color-dot';
      dot.style.background = expr.color ?? '#888';
      dot.title = 'click to change color';
      dot.addEventListener('click', () => this.cycleColor(expr.id));

      const isEditing = this.editingId === expr.id;

      if (isEditing) {
        const input = document.createElement('input');
        input.className = 'expr-input';
        input.type = 'text';
        input.value = expr.latex ?? '';
        input.placeholder = 'LaTeX…';
        input.spellcheck = false;

        input.addEventListener('input', () => this.patchLatex(expr.id, input.value));
        input.addEventListener('blur', () => {
          if (this.editingId === expr.id) this.commitEdit(expr.id, input.value);
        });
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            this.commitEdit(expr.id, input.value);
          }
        });

        row.append(dot, input);
        requestAnimationFrame(() => input.focus());
      } else {
        const mathEl = document.createElement('div');
        mathEl.className = 'expr-math';
        renderLatex(expr.latex ?? '', mathEl);
        mathEl.title = expr.latex ? `LaTeX: ${expr.latex}` : 'click to edit';
        mathEl.addEventListener('click', () => {
          this.editingId = expr.id;
          this.render();
        });
        row.append(dot, mathEl);
      }

      const del = document.createElement('button');
      del.className = 'expr-delete';
      del.textContent = '×';
      del.title = 'Remove';
      del.addEventListener('click', () => this.removeRow(expr.id));

      row.appendChild(del);
      this.listEl.appendChild(row);
    }
  }

  private cycleColor(id: string): void {
    const expr = this.list.find(e => e.id === id);
    if (!expr) return;
    const idx = PALETTE.indexOf(expr.color ?? PALETTE[0]);
    expr.color = PALETTE[(idx + 1) % PALETTE.length];
    this.dirty = true;
    this.render();
    this.onChange([...this.list], true);
  }
}
