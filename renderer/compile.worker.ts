import { compile, type CompileResult } from '../src/index';
import { remapResult } from '../src/plugin/remap';

type CompileWorkerRequest = {
  id: number;
  src: string;
  prelude?: string;
  available?: string[];
  /** present when a plugin macro rewrote the source */
  lineMap?: number[];
};

type CompileWorkerResponse = {
  id: number;
  result: CompileResult;
};

let lastKey: string | null = null;
let lastResult: CompileResult | null = null;

self.addEventListener('message', (event: MessageEvent<CompileWorkerRequest>) => {
  const { id, src, prelude, available, lineMap } = event.data;
  const key = JSON.stringify([src, prelude ?? '', available ?? []]);

  if (key === lastKey && lastResult !== null) {
    self.postMessage({ id, result: lastResult } satisfies CompileWorkerResponse);
    return;
  }

  const compiled = compile(src, { prelude, available });
  const result = lineMap ? remapResult(compiled, lineMap) : compiled;
  lastKey = key;
  lastResult = result;
  self.postMessage({ id, result } satisfies CompileWorkerResponse);
});
