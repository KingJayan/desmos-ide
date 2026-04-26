import { compile, type CompileResult } from '../src/index';

type CompileWorkerRequest = {
  id: number;
  src: string;
};

type CompileWorkerResponse = {
  id: number;
  result: CompileResult;
};

let lastSrc: string | null = null;
let lastResult: CompileResult | null = null;

self.addEventListener('message', (event: MessageEvent<CompileWorkerRequest>) => {
  const { id, src } = event.data;
  if (src === lastSrc && lastResult !== null) {
    self.postMessage({ id, result: lastResult } satisfies CompileWorkerResponse);
    return;
  }
  const result = compile(src);
  lastSrc = src;
  lastResult = result;
  self.postMessage({ id, result } satisfies CompileWorkerResponse);
});
