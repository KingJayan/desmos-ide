/// <reference types="vite/client" />

interface Window {
  MonacoEnvironment: {
    getWorker(moduleId: string, label: string): Worker;
  };
  electronAPI?: import('./bridge').ElectronAPI;
}

declare const Desmos: {
  GraphingCalculator(
    el: HTMLElement,
    opts?: Record<string, unknown>,
  ): DesmosCalculator;
};

interface DesmosCalculator {
  setExpression(expr: Record<string, unknown>): void;
  setExpressions(list: Record<string, unknown>[]): void;
  updateSettings(opts: Record<string, unknown>): void;
  removeExpression(ref: { id: string }): void;
  getExpressions(): Record<string, unknown>[];
  destroy(): void;

  selectedExpressionId?: string;
  graphpaperBounds?: {
    mathCoordinates: { left: number; right: number; top: number; bottom: number; width: number; height: number };
    pixelCoordinates: { left: number; right: number; top: number; bottom: number; width: number; height: number };
  };
  setMathBounds?(bounds: { left: number; right: number; bottom: number; top: number }): void;
  observe?(property: string, cb: () => void): void;
  unobserve?(property: string): void;
  controller?: { dispatch?(action: Record<string, unknown>): void };

  HelperExpression?(opts: { latex: string }): DesmosHelper;
  asyncScreenshot?(
    opts: { format?: 'png' | 'svg'; targetPixelRatio?: number; preserveAxisNumbers?: boolean },
    cb: (data: string) => void,
  ): void;
}

interface DesmosHelper {
  numericValue: number;
  observe(property: string, cb: () => void): void;
  unobserve?(property: string): void;
}
