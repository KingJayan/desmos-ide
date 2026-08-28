import * as monaco from '../monaco';
import { decompile } from '../../src/compiler/decompile';
import type { DesmosExpr } from '../../src/compiler/codegen';
import type { ExprSource } from '../../src/index';

export interface WritebackOptions {
  editor: monaco.editor.IStandaloneCodeEditor;
  model: monaco.editor.ITextModel;
  sourceMap: () => ExprSource[];
}

function freshName(taken: Set<string>): string {
  for (let i = 1; ; i++) {
    const name = `e${i}`;
    if (!taken.has(name)) { taken.add(name); return name; }
  }
}

export class Writeback {
  constructor(private readonly opts: WritebackOptions) {}

  private stmtRange(at: ExprSource): monaco.Range {
    const model = this.opts.model;
    const nextLine = this.opts.sourceMap()
      .filter(e => e.line > at.line)
      .reduce((min, e) => Math.min(min, e.line), model.getLineCount() + 1);
    let endLine = Math.min(Math.max(at.line, nextLine - 1), model.getLineCount());

    //keep blanklines
    while (endLine > at.line && model.getLineContent(endLine).trim() === '') endLine--;
    return new monaco.Range(at.line, 1, endLine, model.getLineMaxColumn(endLine));
  }

  apply(exprs: DesmosExpr[], removedIds: string[] = []): string[] {
    const { editor, model } = this.opts;
    const sourceMap = this.opts.sourceMap();
    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    const refused: string[] = [];
    const taken = new Set(sourceMap.map(e => e.id));
    const appended: string[] = [];

    for (const id of removedIds) {
      const at = sourceMap.find(e => e.id === id);
      if (at) edits.push({ range: this.stmtRange(at), text: '' });
    }

    for (const expr of exprs) {
      const at = expr.id ? sourceMap.find(e => e.id === expr.id) : undefined;

      if (!at) {
        if (!expr.latex?.trim()) continue;
        const statement = decompile(expr, freshName(taken));
        if (!statement) { refused.push(expr.id ?? '?'); continue; }
        appended.push(statement);
        continue;
      }

      const statement = decompile(expr, at.id);
      if (!statement) { refused.push(at.id); continue; }

      const range = this.stmtRange(at);
      const original = model.getValueInRange(range);
      const indent = /^\s*/.exec(original)?.[0] ?? '';
      const style = / as \{[^}]*\}\s*$/.exec(original)?.[0] ?? '';

      edits.push({ range, text: indent + statement + style.trimEnd() });
    }

    if (appended.length) {
      const last = model.getLineCount();
      const at = new monaco.Range(last, model.getLineMaxColumn(last), last, model.getLineMaxColumn(last));
      edits.push({ range: at, text: `\n${appended.join('\n')}` });
    }

    if (edits.length) editor.executeEdits('graph-writeback', edits);
    return refused;
  }
}
