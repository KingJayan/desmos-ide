import type { ClockInfo } from '../src/compiler/codegen';
import { iconEl } from './icons';
import {
  SPEEDS, formatClockValue, formatSpeed, periodFor, scrubToValue, valueToScrub,
} from './transport-state';

/** what the bar needs from the graph, so it can be driven without one in a test */
export interface TransportPorts {
  setPlaying(id: string, playing: boolean): void;
  setPeriod(id: string, period: number): void;
  setValue(id: string, name: string, value: number): void;
  watch(latexName: string, cb: (value: number) => void): () => void;
}

export class Transport {
  private clock: ClockInfo | null = null;
  private speed = 1;
  private playing = true;
  private unwatch: (() => void) | null = null;
  private scrubbing = false;

  private playBtn: HTMLButtonElement;
  private scrubEl: HTMLInputElement;
  private valueEl: HTMLElement;
  private nameEl: HTMLElement;
  private speedEl: HTMLSelectElement;

  constructor(private el: HTMLElement, private ports: TransportPorts) {
    el.className = 'transport hidden';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Timeline');

    this.playBtn = document.createElement('button');
    this.playBtn.className = 'transport-play';
    this.playBtn.addEventListener('click', () => this.setPlaying(!this.playing));

    this.nameEl = document.createElement('span');
    this.nameEl.className = 'transport-name';

    this.scrubEl = document.createElement('input');
    this.scrubEl.type = 'range';
    this.scrubEl.className = 'transport-scrub';
    this.scrubEl.min = '0';
    this.scrubEl.max = '1000';
    this.scrubEl.step = '1';
    this.scrubEl.setAttribute('aria-label', 'Clock position');

    // dragging pauses, the way a video scrubber does
    this.scrubEl.addEventListener('pointerdown', () => { this.scrubbing = true; });
    this.scrubEl.addEventListener('pointerup', () => { this.scrubbing = false; });
    this.scrubEl.addEventListener('input', () => this.onScrub());

    this.valueEl = document.createElement('span');
    this.valueEl.className = 'transport-value';

    this.speedEl = document.createElement('select');
    this.speedEl.className = 'transport-speed';
    this.speedEl.setAttribute('aria-label', 'Playback speed');
    for (const s of SPEEDS) {
      const opt = document.createElement('option');
      opt.value = String(s);
      opt.textContent = formatSpeed(s);
      this.speedEl.appendChild(opt);
    }
    this.speedEl.value = '1';
    this.speedEl.addEventListener('change', () => this.setSpeed(Number(this.speedEl.value)));

    el.append(this.playBtn, this.nameEl, this.scrubEl, this.valueEl, this.speedEl);
    this.syncPlayBtn();
  }

  setClock(clock: ClockInfo | null): void {
    const same = this.clock
      && clock
      && this.clock.id === clock.id
      && this.clock.min === clock.min
      && this.clock.max === clock.max;

    this.clock = clock;
    this.el.classList.toggle('hidden', clock === null);
    if (!clock) {
      this.stopWatching();
      return;
    }

    this.nameEl.textContent = clock.name;
    if (same) {
      // the period is recomputed, since the source may have changed it
      this.ports.setPeriod(clock.id, periodFor(clock.period, this.speed));
      return;
    }

    this.playing = true;
    this.syncPlayBtn();
    this.startWatching(clock);
    this.ports.setPeriod(clock.id, periodFor(clock.period, this.speed));
  }

  dispose(): void {
    this.stopWatching();
  }

  private startWatching(clock: ClockInfo): void {
    this.stopWatching();
    this.unwatch = this.ports.watch(clock.name, value => {
      if (this.scrubbing) return;
      this.valueEl.textContent = formatClockValue(value);
      this.scrubEl.value = String(Math.round(valueToScrub(value, clock.min, clock.max) * 1000));
    });
  }

  private stopWatching(): void {
    this.unwatch?.();
    this.unwatch = null;
  }

  private setPlaying(playing: boolean): void {
    if (!this.clock) return;
    this.playing = playing;
    this.syncPlayBtn();
    this.ports.setPlaying(this.clock.id, playing);
  }

  private setSpeed(speed: number): void {
    this.speed = speed;
    if (this.clock) this.ports.setPeriod(this.clock.id, periodFor(this.clock.period, speed));
  }

  private onScrub(): void {
    if (!this.clock) return;
    const value = scrubToValue(Number(this.scrubEl.value) / 1000, this.clock.min, this.clock.max);
    this.valueEl.textContent = formatClockValue(value);
    // a scrub is a hand on the clock, so it stops playing
    if (this.playing) {
      this.playing = false;
      this.syncPlayBtn();
    }
    this.ports.setValue(this.clock.id, this.clock.name, value);
  }

  private syncPlayBtn(): void {
    this.playBtn.replaceChildren(iconEl(this.playing ? 'pause' : 'play', { size: 13 }));
    const label = this.playing ? 'Pause' : 'Play';
    this.playBtn.title = label;
    this.playBtn.setAttribute('aria-label', label);
  }
}
