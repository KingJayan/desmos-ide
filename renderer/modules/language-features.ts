import * as monaco from '../monaco';
import { LANGUAGE_ID, KEYWORDS, BUILTIN_FNS } from '../../src/monaco/language';
import { builtinDoc, builtinSignature } from '../../src/compiler/builtins';
import { formatDsl } from '../../src/compiler/format';
import { findRenameEdits, isValidIdent } from '../../src/compiler/rename';
import type { CompileResult } from '../../src/index';

const RESERVED = new Set<string>([...KEYWORDS, ...BUILTIN_FNS]);

const reject = (reason: string): monaco.languages.RenameLocation & monaco.languages.Rejection =>
  ({ text: '', range: new monaco.Range(0, 0, 0, 0), rejectReason: reason });

/** hover, go to definition, rename and format, all answered from the last good compile */
export function registerLanguageFeatures(lastResult: () => CompileResult | null): void {
  monaco.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, {
    provideDocumentFormattingEdits(model) {
      const formatted = formatDsl(model.getValue());
      if (formatted === model.getValue()) return [];
      return [{ range: model.getFullModelRange(), text: formatted }];
    },
  });

  monaco.languages.registerHoverProvider(LANGUAGE_ID, {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);

      const sig = builtinSignature(word.word);
      if (sig) {
        const doc = builtinDoc(word.word);
        return {
          range,
          contents: doc
            ? [{ value: `\`\`\`\n${sig}\n\`\`\``, isTrusted: true }, { value: doc, isTrusted: true }]
            : [{ value: `\`\`\`\n${sig}\n\`\`\``, isTrusted: true }],
        };
      }

      const result = lastResult();
      if (!result?.success) return null;
      const sym = result.symbols.find(s => s.name === word.word);
      if (!sym) return null;

      const list = result.state.expressions.list;
      const expr = list.find(e => e.id === sym.name) ?? list.find(e => e.id.startsWith(sym.name));

      const kindLabel = sym.kind.charAt(0).toUpperCase() + sym.kind.slice(1);
      const contents: { value: string; isTrusted: boolean }[] = [
        { value: `**${kindLabel}** \`${sym.name}\` — line ${sym.line}`, isTrusted: true },
      ];

      if (expr?.latex) {
        // strip leading "name=" binding to show just the value when it's an assignment
        const rhs = expr.latex.replace(/^[^=]+=/, '');
        contents.push({ value: `\`\`\`latex\n${rhs}\n\`\`\``, isTrusted: true });
      }

      if (sym.kind === 'fn') {
        contents.push({ value: `\`\`\`\n${model.getLineContent(sym.line).trim()}\n\`\`\``, isTrusted: true });
      }

      return { range, contents };
    },
  });

  monaco.languages.registerDefinitionProvider(LANGUAGE_ID, {
    provideDefinition(model, position) {
      const result = lastResult();
      if (!result?.success) return null;
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const sym = result.symbols.find(s => s.name === word.word);
      if (!sym) return null;
      return {
        uri: model.uri,
        range: new monaco.Range(sym.line, sym.col, sym.line, sym.col + sym.name.length),
      };
    },
  });

  monaco.languages.registerRenameProvider(LANGUAGE_ID, {
    resolveRenameLocation(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return reject('No symbol at cursor');
      if (RESERVED.has(word.word)) return reject('Cannot rename built-in keyword');
      const result = lastResult();
      if (!result?.success) return reject('File must compile successfully to rename');
      if (!result.symbols.some(s => s.name === word.word)) return reject('Symbol not declared in this file');
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        text: word.word,
      };
    },
    provideRenameEdits(model, position, newName) {
      const word = model.getWordAtPosition(position);
      if (!word || RESERVED.has(word.word)) return { edits: [] };
      if (!isValidIdent(newName)) return { edits: [], rejectReason: `"${newName}" is not a valid name` };
      return {
        edits: findRenameEdits(model.getValue(), word.word).map(e => ({
          resource: model.uri,
          textEdit: {
            range: new monaco.Range(e.line, e.col, e.line, e.col + e.length),
            text: newName,
          },
          versionId: undefined,
        })),
      };
    },
  });
}
