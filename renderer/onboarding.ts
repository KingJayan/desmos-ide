import { iconEl } from './icons';

export interface TourStep {
  target: () => HTMLElement | null;
  title: string;
  body: string;
}

export interface OnboardingOptions {
  steps: TourStep[];
  onFinish: () => void;
  openExample: () => Promise<void> | void;
}

const GAP = 12;

export class Onboarding {
  private welcome: HTMLElement;
  private pop: HTMLElement;
  private ring: HTMLElement;
  private popTitle: HTMLElement;
  private popBody: HTMLElement;
  private popCount: HTMLElement;
  private nextBtn: HTMLButtonElement;
  private step = 0;
  private running = false;
  private previousFocus: HTMLElement | null = null;
  private onKey = (e: KeyboardEvent) => {
    if (!this.running) return;
    if (e.key === 'Escape') { e.preventDefault(); this.end(); return; }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); this.advance(); }
  };
  private onReflow = () => this.place();

  constructor(private opts: OnboardingOptions) {
    this.welcome = this.buildWelcome();
    const built = this.buildPopover();
    this.pop = built.pop;
    this.ring = built.ring;
    this.popTitle = built.title;
    this.popBody = built.body;
    this.popCount = built.count;
    this.nextBtn = built.next;
    document.body.append(this.welcome, this.ring, this.pop);
  }

  private buildWelcome(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'welcome');

    const modal = document.createElement('div');
    modal.className = 'welcome-modal';

    const mark = iconEl('dsmx-mark', { size: 40, strokeWidth: 1.6 });
    mark.classList.add('welcome-mark');

    const title = document.createElement('h1');
    title.className = 'welcome-title';
    title.textContent = 'welcome to dsmx';

    const lead = document.createElement('p');
    lead.className = 'welcome-lead';
    lead.textContent = 'A text language for Desmos graphs. What you write compiles to the graph beside it.';

    const list = document.createElement('ul');
    list.className = 'welcome-list';
    for (const item of [
      'write statements on the left, watch the graph on the right',
      'all actions are in the command palette (⇧⌘P)',
      'the file on disk is always the DSL source',
    ]) {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    }

    const actions = document.createElement('div');
    actions.className = 'welcome-actions';

    const tour = document.createElement('button');
    tour.className = 'btn welcome-btn welcome-btn--primary';
    tour.textContent = 'take the tour';
    tour.addEventListener('click', () => {
      this.hideWelcome();
      void Promise.resolve(this.opts.openExample()).then(() => this.start());
    });

    const example = document.createElement('button');
    example.className = 'btn welcome-btn';
    example.textContent = 'open an example';
    example.addEventListener('click', () => {
      this.hideWelcome();
      void Promise.resolve(this.opts.openExample()).then(() => this.opts.onFinish());
    });

    const skip = document.createElement('button');
    skip.className = 'btn welcome-btn welcome-btn--quiet';
    skip.textContent = 'skip';
    skip.addEventListener('click', () => { this.hideWelcome(); this.opts.onFinish(); });

    actions.append(tour, example, skip);
    modal.append(mark, title, lead, list, actions);
    overlay.appendChild(modal);

    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hideWelcome();
        this.opts.onFinish();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>('button'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    return overlay;
  }

  private buildPopover(): {
    pop: HTMLElement; ring: HTMLElement; title: HTMLElement; body: HTMLElement;
    count: HTMLElement; next: HTMLButtonElement;
  } {
    const ring = document.createElement('div');
    ring.className = 'tour-ring hidden';
    ring.setAttribute('aria-hidden', 'true');

    const pop = document.createElement('div');
    pop.className = 'tour-pop hidden';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-live', 'polite');

    const count = document.createElement('span');
    count.className = 'tour-count';

    const title = document.createElement('div');
    title.className = 'tour-title';

    const body = document.createElement('p');
    body.className = 'tour-body';

    const actions = document.createElement('div');
    actions.className = 'tour-actions';

    const skip = document.createElement('button');
    skip.className = 'btn tour-btn tour-btn--quiet';
    skip.textContent = 'skip tour';
    skip.addEventListener('click', () => this.end());

    const next = document.createElement('button');
    next.className = 'btn tour-btn tour-btn--primary';
    next.textContent = 'next';
    next.addEventListener('click', () => this.advance());

    actions.append(skip, next);
    pop.append(count, title, body, actions);

    return { pop, ring, title, body, count, next };
  }

  showWelcome(): void {
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.welcome.classList.remove('hidden');
    const first = this.welcome.querySelector<HTMLElement>('button');
    first?.focus();
  }

  private hideWelcome(): void {
    this.welcome.classList.add('hidden');
    this.previousFocus?.focus();
    this.previousFocus = null;
  }

  start(): void {
    if (this.opts.steps.length === 0) { this.opts.onFinish(); return; }
    this.step = 0;
    this.running = true;
    this.pop.classList.remove('hidden');
    this.ring.classList.remove('hidden');
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('resize', this.onReflow);
    this.render();
    this.nextBtn.focus();
  }

  private advance(): void {
    if (this.step >= this.opts.steps.length - 1) { this.end(); return; }
    this.step += 1;
    this.render();
  }

  private end(): void {
    if (!this.running) return;
    this.running = false;
    this.pop.classList.add('hidden');
    this.ring.classList.add('hidden');
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('resize', this.onReflow);
    this.opts.onFinish();
  }

  private render(): void {
    const step = this.opts.steps[this.step];
    if (!step) { this.end(); return; }
    this.popCount.textContent = `${this.step + 1}/${this.opts.steps.length}`;
    this.popTitle.textContent = step.title;
    this.popBody.textContent = step.body;
    this.nextBtn.textContent = this.step === this.opts.steps.length - 1 ? 'done' : 'next';
    this.place();
  }

  private place(): void {
    const step = this.opts.steps[this.step];
    const target = step?.target() ?? null;
    if (!target) { this.ring.classList.add('hidden'); return; }

    const box = target.getBoundingClientRect();
    this.ring.classList.remove('hidden');
    this.ring.style.left = `${box.left}px`;
    this.ring.style.top = `${box.top}px`;
    this.ring.style.width = `${box.width}px`;
    this.ring.style.height = `${box.height}px`;

    const pop = this.pop.getBoundingClientRect();
    let left: number;
    let top: number;

    if (box.width > window.innerWidth * 0.6) {
      // a bar that spans the window has no side to sit beside, so the popover clears it
      left = box.left + box.width / 2 - pop.width / 2;
      top = box.top - pop.height - GAP;
      if (top < GAP) top = box.bottom + GAP;
    } else {
      const roomRight = window.innerWidth - box.right;
      left = roomRight > pop.width + GAP * 2 ? box.right + GAP : box.left - pop.width - GAP;
      if (left < GAP) left = Math.min(box.left + GAP, window.innerWidth - pop.width - GAP);
      top = box.top + Math.min(box.height / 2, 40);
    }

    left = Math.max(GAP, Math.min(left, window.innerWidth - pop.width - GAP));
    top = Math.max(GAP, Math.min(top, window.innerHeight - pop.height - GAP));

    this.pop.style.left = `${Math.max(GAP, left)}px`;
    this.pop.style.top = `${top}px`;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('resize', this.onReflow);
    this.welcome.remove();
    this.pop.remove();
    this.ring.remove();
  }
}
