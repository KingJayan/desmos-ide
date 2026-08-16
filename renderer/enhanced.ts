import type { DesmosExpr } from '../src/compiler/codegen';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { iconEl } from './icons';

const PALETTE = ['#2d70b3', '#c74440', '#388c46', '#6042a6', '#fa7e19', '#000000'];
// typing and dragging change the list many times a second, and every change redraws
// the graph. the wait collects them into one redraw
const NOTIFY_DELAY = 120;

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
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private rows = new Map<string, HTMLElement>();

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

  dispose(): void {
    if (this.notifyTimer !== null) clearTimeout(this.notifyTimer);
    this.notifyTimer = null;
  }

  syncFromGraph(graphList: DesmosExpr[]): void {
    this.dispose();
    this.list = graphList
      .filter(e => e.type === 'expression')
      .map(e => ({ ...e }));
    this.dirty = false;
    this.editingId = null;
    this.render();
  }

  private notifySoon(): void {
    if (this.notifyTimer !== null) clearTimeout(this.notifyTimer);
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.onChange([...this.list], this.dirty);
    }, NOTIFY_DELAY);
  }

  private notifyNow(): void {
    if (this.notifyTimer !== null) clearTimeout(this.notifyTimer);
    this.notifyTimer = null;
    this.onChange([...this.list], this.dirty);
  }

  private addRow(): void {
    const id = String(this.nextId++);
    this.list.push({ type: 'expression', id, latex: '', color: PALETTE[0] });
    this.dirty = true;
    this.editingId = id;
    this.render();
    this.rows.get(id)?.querySelector<HTMLInputElement>('.expr-input')?.focus();
    this.notifyNow();
  }

  private removeRow(id: string): void {
    this.list = this.list.filter(e => e.id !== id);
    this.dirty = true;
    if (this.editingId === id) this.editingId = null;
    this.render();
    this.notifyNow();
  }

  private patchLatex(id: string, latex: string): void {
    const expr = this.list.find(e => e.id === id);
    if (expr) {
      expr.latex = latex;
      this.dirty = true;
      this.notifySoon();
    }
  }

  private commitEdit(id: string, value: string): void {
    this.patchLatex(id, value);
    this.editingId = null;
    this.refreshRow(id);
    this.notifyNow();
  }

  private refreshRow(id: string): void {
    const old = this.rows.get(id);
    const expr = this.list.find(e => e.id === id);
    if (!old || !expr) return;
    const next = this.buildRow(expr);
    old.replaceWith(next);
    this.rows.set(id, next);
  }

  private render(): void {
    this.listEl.replaceChildren();
    this.rows.clear();
    const frag = document.createDocumentFragment();
    for (const expr of this.list) {
      const row = this.buildRow(expr);
      this.rows.set(expr.id!, row);
      frag.appendChild(row);
    }
    this.listEl.appendChild(frag);
  }

  private buildRow(expr: DesmosExpr): HTMLElement {
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
        const wasEditing = this.editingId;
        this.editingId = expr.id;
        if (wasEditing) this.refreshRow(wasEditing);
        this.refreshRow(expr.id);
      });

      const sliderMatch = /^([a-zA-Z_]\w*)\s*=\s*(-?\d+(?:\.\d*)?)$/.exec(expr.latex ?? '');
      if (sliderMatch) {
        const sliderVal = parseFloat(sliderMatch[2]);
        const abs = Math.abs(sliderVal);
        const span = Math.max(abs * 3, 10);
        const step = Number.isInteger(sliderVal) ? 1 : 0.01;
        const min = Math.floor(sliderVal - span);
        const max = Math.ceil(sliderVal + span);

        const sliderWrap = document.createElement('div');
        sliderWrap.className = 'expr-slider-wrap';

        const track = document.createElement('input');
        track.type = 'range';
        track.className = 'expr-slider-track';
        track.min = String(min);
        track.max = String(max);
        track.step = String(step);
        track.value = String(sliderVal);

        const badge = document.createElement('span');
        badge.className = 'expr-slider-badge';
        badge.textContent = step === 1 ? String(sliderVal) : sliderVal.toFixed(2);

        const updateFill = () => {
          const pct = ((parseFloat(track.value) - min) / (max - min)) * 100;
          track.style.background = `linear-gradient(to right, var(--blue) ${pct}%, var(--surface1) ${pct}%)`;
        };
        updateFill();

        track.addEventListener('input', () => {
          const raw = parseFloat(track.value);
          const newStr = step === 1 ? String(Math.round(raw)) : raw.toFixed(2);
          badge.textContent = newStr;
          updateFill();
          const newLatex = `${sliderMatch[1]}=${newStr}`;
          this.patchLatex(expr.id, newLatex);
        });

        track.addEventListener('mousedown', e => e.stopPropagation());

        sliderWrap.append(track, badge);
        row.append(dot, mathEl, sliderWrap);
      } else {
        row.append(dot, mathEl);
      }
    }

    const del = document.createElement('button');
    del.className = 'expr-delete';
    del.appendChild(iconEl('x', { size: 12 }));
    del.title = 'Remove';
    del.addEventListener('click', () => this.removeRow(expr.id));

    row.appendChild(del);
    return row;
  }

  private cycleColor(id: string): void {
    const expr = this.list.find(e => e.id === id);
    if (!expr) return;
    const idx = PALETTE.indexOf(expr.color ?? PALETTE[0]);
    expr.color = PALETTE[(idx + 1) % PALETTE.length];
    this.dirty = true;
    // only the dot changed, so the rest of the list keeps the dom it already has
    const dot = this.rows.get(id)?.querySelector<HTMLElement>('.expr-color-dot');
    if (dot) dot.style.background = expr.color;
    else this.render();
    this.notifyNow();
  }
}
