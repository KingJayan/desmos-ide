/** the expressions that have no DSL form, so they are on the graph but not in the saved file */
export class GraphOnly {
  private ids = new Set<string>();

  get count(): number { return this.ids.size; }

  /** every id that was looked at drops out first, so one that now writes back stops counting */
  record(refused: string[], seen: (string | undefined)[] = []): void {
    for (const id of seen) if (id) this.ids.delete(id);
    for (const id of refused) this.ids.add(id);
  }

  clear(): void { this.ids.clear(); }

  label(): string {
    return this.ids.size ? `${this.ids.size} graph-only` : '';
  }

  title(): string {
    const n = this.ids.size;
    if (!n) return '';
    const [subject, object] = n === 1 ? ['it is', 'it'] : ['they are', 'them'];
    return `${n} expression${n === 1 ? ' has' : 's have'} no DSL form, so ${subject} not in the saved file.`
      + ` Open the enhanced view to export ${object}.`;
  }
}
