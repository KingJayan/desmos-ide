import type { DesmosExpr } from '../src/compiler/codegen';

const PALETTE = ['#2d70b3', '#c74440', '#388c46', '#6042a6', '#fa7e19', '#000000'];

export class EnhancedPane {
  private list: DesmosExpr[] = [];
  private nextId = 1000;
  private dirty = false;

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
    this.render();
  }

  private addRow(): void {
    const id = String(this.nextId++);
    this.list.push({ type: 'expression', id, latex: '', color: PALETTE[0] });
    this.dirty = true;
    this.render();
    const inputs = this.listEl.querySelectorAll<HTMLInputElement>('.expr-input');
    inputs[inputs.length - 1]?.focus();
    this.onChange([...this.list], true);
  }

  private removeRow(id: string): void {
    this.list = this.list.filter(e => e.id !== id);
    this.dirty = true;
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

  private render(): void {
    this.listEl.innerHTML = '';
    for (const expr of this.list) {
      const row = document.createElement('div');
      row.className = 'expr-row';

      const idBadge = document.createElement('span');
      idBadge.className = 'expr-id';
      idBadge.textContent = expr.id;

      const dot = document.createElement('span');
      dot.className = 'expr-color-dot';
      dot.style.background = expr.color ?? '#888';

      const input = document.createElement('input');
      input.className = 'expr-input';
      input.type = 'text';
      input.value = expr.latex ?? '';
      input.placeholder = 'LaTeX…';
      input.spellcheck = false;
      input.addEventListener('input', () => this.patchLatex(expr.id, input.value));

      const del = document.createElement('button');
      del.className = 'expr-delete';
      del.textContent = '×';
      del.title = 'Remove';
      del.addEventListener('click', () => this.removeRow(expr.id));

      row.append(idBadge, dot, input, del);
      this.listEl.appendChild(row);
    }
  }
}
