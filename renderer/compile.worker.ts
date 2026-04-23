import { compile, type CompileResult } from '../src/index';

type CompileWorkerRequest = {
  id: number;
  src: string;
};

type CompileWorkerResponse = {
  id: number;
  result: CompileResult;
};

self.addEventListener('message', (event: MessageEvent<CompileWorkerRequest>) => {
  const { id, src } = event.data;
  const result = compile(src);
  const response: CompileWorkerResponse = { id, result };
  self.postMessage(response);
});
