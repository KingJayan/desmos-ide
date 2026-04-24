import * as monaco from 'monaco-editor';

interface SliderVar {
  name: string;
  value: number;
  numStr: string;
  line: number;
  col: number;
  domainMin: number;
  domainMax: number;
}

// matches: let name = value [min..max]  (whitespace flexible)
const SLIDER_LINE_RE = /^(let\s+\w+\s*=\s*)(-?\d+(?:\.\d*)?)\s*\[\s*(-?\d+(?:\.\d*)?)\s*\.\.\s*(-?\d+(?:\.\d*)?)\s*\]/;

function parseSliderVars(src: string): SliderVar[] {
  const results: SliderVar[] = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SLIDER_LINE_RE);
    if (!m) continue;
    const prefix = m[1];
    const numStr = m[2];
    const value = parseFloat(numStr);
    const domainMin = parseFloat(m[3]);
    const domainMax = parseFloat(m[4]);
    if (!isFinite(value) || !isFinite(domainMin) || !isFinite(domainMax)) continue;
    results.push({
      name: /let\s+(\w+)/.exec(lines[i])![1],
      value,
      numStr,
      line: i + 1,
      col: prefix.length + 1,
      domainMin,
      domainMax,
    });
  }
  return results;
}

function sliderRange(info: SliderVar): { min: number; max: number; step: number } {
  const step = Number.isInteger(info.domainMin) && Number.isInteger(info.domainMax) && Number.isInteger(info.value) ? 1 : 0.01;
  return { min: info.domainMin, max: info.domainMax, step };
}

class SliderWidget implements monaco.editor.IContentWidget {
  readonly allowEditorOverflow = true;
  private dom: HTMLElement;
  private track: HTMLInputElement;
  private valueLabel: HTMLSpanElement;
  private minLabel: HTMLSpanElement;
  private maxLabel: HTMLSpanElement;
  private _id: string;
  private line: number;
  private min: number;
  private max: number;
  private step: number;

  constructor(
    private editor: monaco.editor.IStandaloneCodeEditor,
    info: SliderVar,
    private onchange: (line: number, col: number, oldLen: number, newVal: string) => void,
  ) {
    this._id = `slider-${info.name}-${info.line}`;
    this.line = info.line;
    const { min, max, step } = sliderRange(info);
    this.min = min; this.max = max; this.step = step;

    this.dom = document.createElement('div');
    this.dom.className = 'inline-slider-widget';

    this.minLabel = document.createElement('span');
    this.minLabel.className = 'inline-slider-bound';
    this.minLabel.textContent = String(min);

    this.track = document.createElement('input');
    this.track.type = 'range';
    this.track.className = 'inline-slider-track';
    this.track.min = String(min);
    this.track.max = String(max);
    this.track.step = String(step);
    this.track.value = String(info.value);

    this.maxLabel = document.createElement('span');
    this.maxLabel.className = 'inline-slider-bound';
    this.maxLabel.textContent = String(max);

    this.valueLabel = document.createElement('span');
    this.valueLabel.className = 'inline-slider-label';
    this.valueLabel.textContent = this.fmt(info.value);

    this.dom.append(this.minLabel, this.track, this.maxLabel, this.valueLabel);

    this.updateFill();

    let dragging = false;
    let lastLen = info.numStr.length;

    const emitChange = () => {
      const rawVal = parseFloat(this.track.value);
      const newStr = step === 1 ? String(Math.round(rawVal)) : rawVal.toFixed(2);
      this.valueLabel.textContent = newStr;
      this.updateFill();
      this.onchange(this.line, info.col, lastLen, newStr);
      lastLen = newStr.length;
    };

    this.track.addEventListener('mousedown', e => { dragging = true; e.stopPropagation(); });
    this.track.addEventListener('input', () => { if (dragging) emitChange(); });
    this.track.addEventListener('change', () => { emitChange(); dragging = false; });
    this.track.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
    });
    this.dom.addEventListener('mousedown', e => e.stopPropagation());
    this.dom.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  }

  private fmt(v: number): string {
    return this.step === 1 ? String(Math.round(v)) : v.toFixed(2);
  }

  private updateFill(): void {
    const pct = ((parseFloat(this.track.value) - this.min) / (this.max - this.min)) * 100;
    this.track.style.background = `linear-gradient(to right, var(--mauve) ${pct}%, var(--surface1) ${pct}%)`;
  }

  updateValue(info: SliderVar): void {
    const { min, max, step } = sliderRange(info);
    this.min = min; this.max = max; this.step = step;
    this.track.min = String(min);
    this.track.max = String(max);
    this.track.step = String(step);
    this.minLabel.textContent = String(min);
    this.maxLabel.textContent = String(max);
    const cur = parseFloat(this.track.value);
    if (Math.abs(cur - info.value) > 1e-9) {
      this.track.value = String(info.value);
      this.valueLabel.textContent = this.fmt(info.value);
      this.updateFill();
    }
  }

  getId(): string { return this._id; }
  getDomNode(): HTMLElement { return this.dom; }

  getPosition(): monaco.editor.IContentWidgetPosition {
    const model = this.editor.getModel();
    const lineLen = model ? model.getLineLength(this.line) : 1;
    return {
      position: { lineNumber: this.line, column: lineLen + 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
    };
  }
}

export class InlineSliderManager {
  private widgets = new Map<string, SliderWidget>();
  private vars = new Map<string, SliderVar>();
  private decorCollection: monaco.editor.IEditorDecorationsCollection | null = null;

  constructor(private editor: monaco.editor.IStandaloneCodeEditor) {
    this.decorCollection = editor.createDecorationsCollection([]);
  }

  update(src: string): void {
    const found = parseSliderVars(src);
    const model = this.editor.getModel();
    if (!model) return;

    const foundKeys = new Set<string>();

    for (const info of found) {
      const key = `${info.name}-${info.line}`;
      foundKeys.add(key);

      if (this.widgets.has(key)) {
        this.widgets.get(key)!.updateValue(info);
        this.vars.set(key, info);
        this.editor.layoutContentWidget(this.widgets.get(key)!);
      } else {
        let w!: SliderWidget;
        w = new SliderWidget(this.editor, info, (line, col, oldLen, newVal) => {
          const stored = this.vars.get(key);
          if (!stored) return;
          const range = new monaco.Range(line, col, line, col + oldLen);
          this.editor.executeEdits('inline-slider', [{ range, text: newVal }]);
          stored.numStr = newVal;
          stored.value = parseFloat(newVal);
          this.editor.layoutContentWidget(w);
        });
        this.editor.addContentWidget(w);
        this.widgets.set(key, w);
        this.vars.set(key, info);
      }
    }

    for (const [key, w] of this.widgets) {
      if (!foundKeys.has(key)) {
        this.editor.removeContentWidget(w);
        this.widgets.delete(key);
        this.vars.delete(key);
      }
    }

    this.decorCollection!.set(
      found.map(info => ({
        range: new monaco.Range(info.line, 1, info.line, 1),
        options: { isWholeLine: true, className: 'inline-slider-line' },
      })),
    );
  }

  dispose(): void {
    for (const w of this.widgets.values()) this.editor.removeContentWidget(w);
    this.widgets.clear();
    this.vars.clear();
    this.decorCollection!.clear();
  }
}
