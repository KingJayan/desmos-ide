// finds `a = slider(value, min, max)` declarations so the editor can draw a drag
// handle over them. kept free of monaco imports so it can be tested on its own.

export interface SliderVar {
  name: string;
  value: number;
  numStr: string;
  line: number;
  col: number;
  domainMin: number;
  domainMax: number;
  step?: number;
}

const NUM = '-?\\d+(?:\\.\\d*)?';

const SLIDER_LINE_RE = new RegExp(
  `^(\\s*(\\w+)\\s*=\\s*slider\\(\\s*)(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})`,
);

// an explicit `step=` kwarg wins over the step inferred from the bounds
const STEP_KWARG_RE = new RegExp(`\\bstep\\s*=\\s*(${NUM})`);

export function parseSliderVars(src: string): SliderVar[] {
  const results: SliderVar[] = [];
  const lines = src.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const comment = lines[i].indexOf('//');
    const code = comment === -1 ? lines[i] : lines[i].slice(0, comment);

    const m = code.match(SLIDER_LINE_RE);
    if (!m) continue;

    const [, prefix, name, numStr, minStr, maxStr] = m;
    const value = parseFloat(numStr);
    const domainMin = parseFloat(minStr);
    const domainMax = parseFloat(maxStr);
    if (!isFinite(value) || !isFinite(domainMin) || !isFinite(domainMax)) continue;
    // a zero-width or inverted range has no draggable positions
    if (domainMax <= domainMin) continue;

    const stepMatch = code.slice(prefix.length).match(STEP_KWARG_RE);
    const step = stepMatch ? Math.abs(parseFloat(stepMatch[1])) : 0;

    results.push({
      name,
      value,
      numStr,
      line: i + 1,
      col: prefix.length + 1,
      domainMin,
      domainMax,
      step: step > 0 ? step : undefined,
    });
  }

  return results;
}

export function sliderRange(info: SliderVar): { min: number; max: number; step: number } {
  const bounds = { min: info.domainMin, max: info.domainMax };
  if (info.step) return { ...bounds, step: info.step };
  const allInts = Number.isInteger(info.domainMin)
    && Number.isInteger(info.domainMax)
    && Number.isInteger(info.value);
  return { ...bounds, step: allInts ? 1 : 0.01 };
}
