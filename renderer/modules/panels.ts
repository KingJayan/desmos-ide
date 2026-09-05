import { iconEl } from '../icons';
import { DOM } from './dom';
import { relativeTime } from '../../src/shared/relative-time';
import type { SymbolInfo } from '../../src/index';

export interface Problem {
  severity: 'error' | 'warning';
  message: string;
  line: number;
  col: number;
}

export interface TimelineRow {
  when: string;
  kind: string;
  what: string;
  who?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0]!.slice(0, 2) : parts[0]![0]! + parts.at(-1)![0]!).toUpperCase();
}

function activate(row: HTMLElement, run: () => void): void {
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.addEventListener('click', run);
  row.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    run();
  });
}

export class Outline {
  constructor(private readonly jump: (line: number, col: number) => void) {}

  render(symbols: SymbolInfo[]): void {
    DOM.outlineList.replaceChildren();
    if (symbols.length === 0) {
      DOM.outlineEmpty.classList.remove('outline-empty--hidden');
      return;
    }
    DOM.outlineEmpty.classList.add('outline-empty--hidden');
    for (const sym of symbols) {
      const li = document.createElement('li');
      li.className = 'outline-item';
      li.title = `${sym.kind} ${sym.name} — line ${sym.line}`;
      li.setAttribute('aria-label', `${sym.kind} ${sym.name}, line ${sym.line}`);

      const badge = document.createElement('span');
      badge.className = `outline-badge outline-badge--${sym.kind}`;
      badge.textContent = sym.kind;

      const name = document.createElement('span');
      name.className = 'outline-name';
      name.textContent = sym.name;

      const lineNum = document.createElement('span');
      lineNum.className = 'outline-line';
      lineNum.textContent = String(sym.line);

      li.append(badge, name, lineNum);
      activate(li, () => this.jump(sym.line, sym.col));
      DOM.outlineList.appendChild(li);
    }
  }
}

export class ProblemsPanel {
  private problems: Problem[] = [];
  private show = { error: true, warning: true };
  private readonly filters = new Map<'error' | 'warning', HTMLButtonElement>();

  constructor(private readonly jump: (line: number, col: number) => void) {
    const bar = document.createElement('div');
    bar.className = 'problem-filters';
    for (const severity of ['error', 'warning'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `problem-filter problem-filter--${severity}`;
      button.setAttribute('aria-pressed', 'true');
      button.append(
        iconEl(severity === 'error' ? 'circle-x' : 'triangle-alert', { size: 12 }),
        document.createTextNode(severity === 'error' ? 'errors' : 'warnings'),
      );
      const count = document.createElement('span');
      count.className = 'problem-filter-count';
      button.appendChild(count);
      button.addEventListener('click', () => {
        this.show[severity] = !this.show[severity];
        this.render(this.problems);
      });
      this.filters.set(severity, button);
      bar.appendChild(button);
    }
    DOM.problemsBody.prepend(bar);
  }

  render(problems: Problem[]): void {
    this.problems = problems;
    DOM.problemsList.replaceChildren();

    const errors = problems.filter(p => p.severity === 'error').length;
    const badgeText = String(problems.length);
    DOM.problemsBadge.textContent = badgeText;
    DOM.problemsCount.textContent = badgeText;
    DOM.problemsBadge.classList.toggle('hidden', problems.length === 0);
    DOM.problemsCount.classList.toggle('hidden', problems.length === 0);
    DOM.problemsBadge.style.background = errors ? 'var(--red)' : 'var(--yellow)';

    for (const [severity, button] of this.filters) {
      const total = severity === 'error' ? errors : problems.length - errors;
      button.querySelector('.problem-filter-count')!.textContent = String(total);
      button.setAttribute('aria-pressed', String(this.show[severity]));
      button.classList.toggle('problem-filter--off', !this.show[severity]);
      button.disabled = total === 0;
    }

    const shown = problems.filter(p => this.show[p.severity === 'error' ? 'error' : 'warning']);
    DOM.problemsEmptyText.textContent = problems.length === 0
      ? 'no problems, the file compiles'
      : 'every problem is filtered out';
    DOM.problemsEmpty.classList.toggle('hidden', shown.length > 0);

    for (const p of shown) {
      const li = document.createElement('li');
      li.className = 'problem-row';

      const sev = document.createElement('span');
      sev.className = `problem-sev problem-sev--${p.severity}`;
      sev.appendChild(iconEl(p.severity === 'error' ? 'circle-x' : 'triangle-alert', { size: 13 }));
      sev.setAttribute('aria-label', p.severity);

      const loc = document.createElement('span');
      loc.className = 'problem-loc';
      loc.textContent = `${p.line}:${p.col}`;

      const msg = document.createElement('span');
      msg.className = 'problem-msg';
      msg.textContent = p.message;

      li.append(sev, loc, msg);
      activate(li, () => this.jump(p.line, p.col));
      DOM.problemsList.appendChild(li);
    }
  }
}

export class Timeline {
  private readonly saves: { when: number; what: string }[] = [];

  note(what: string): void {
    this.saves.unshift({ when: Date.now(), what });
    if (this.saves.length > 20) this.saves.pop();
  }

  async refresh(): Promise<void> {
    const rows: TimelineRow[] = this.saves.map(s => ({
      when: relativeTime(s.when),
      kind: 'save',
      what: s.what,
    }));

    const log = await window.electronAPI?.gitHistory(20).catch(() => null);
    if (log?.ok) {
      for (const commit of log.commits) {
        rows.push({ when: relativeTime(Date.parse(commit.date)), kind: 'commit', what: commit.subject, who: commit.author });
      }
    }

    DOM.timelineList.replaceChildren();
    DOM.timelineEmpty.classList.toggle('hidden', rows.length > 0);
    for (const row of rows) {
      const li = document.createElement('li');
      li.className = 'timeline-row';

      const who = document.createElement('span');
      who.className = 'timeline-who';
      who.textContent = row.who ? initials(row.who) : '·';
      if (row.who) who.title = row.who;

      const what = document.createElement('span');
      what.className = 'timeline-what';
      what.textContent = row.what;

      const when = document.createElement('span');
      when.className = 'timeline-when';
      when.textContent = row.when;

      li.append(who, what, when);
      li.title = `${row.kind}${row.who ? ` by ${row.who}` : ''} — ${row.when}`;
      DOM.timelineList.appendChild(li);
    }
  }
}
