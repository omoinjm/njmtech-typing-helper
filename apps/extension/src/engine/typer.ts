import { createScheduler } from './scheduler';
import { neighbourKey, shouldTypo } from './errors';
import type { Rng } from './random';

export interface TextSource {
  /** Live remaining text read from the page, or null if the page doesn't expose progress. */
  remaining(): string | null;
  /** Full passage captured at start; used with an internal cursor when `remaining` is null. */
  snapshot(): string | null;
  isFinished?(): boolean;
}

export interface Injector {
  type(ch: string): Promise<void>;
  backspace(): Promise<void>;
  dispose?(): Promise<void>;
}

export interface TyperOptions {
  wpm: number;
  accuracy: number;
  /** Consecutive keystrokes that don't change live text before giving up. */
  maxStalls?: number;
}

export interface TyperDeps {
  rng: Rng;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Called after a keystroke so the page can re-render before we re-read it. */
  settle?: () => Promise<void>;
}

export type StopReason = 'done' | 'stopped' | 'stalled' | 'no-text';

export class Typer {
  private stopped = false;
  typed = 0;

  constructor(
    private source: TextSource,
    private injector: Injector,
    private opts: TyperOptions,
    private deps: TyperDeps,
  ) {}

  stop() {
    this.stopped = true;
  }

  async run(): Promise<StopReason> {
    const { rng, now, sleep } = this.deps;
    const settle = this.deps.settle ?? (() => Promise.resolve());
    const scheduler = createScheduler({ wpm: this.opts.wpm }, rng);
    const maxStalls = this.opts.maxStalls ?? 4;

    const full = this.source.snapshot() ?? '';
    let cursor = 0;
    let stalls = 0;
    // Whitespace the page accepted without visible change (many sites only mark
    // letters). Skipped while the live text stays the same.
    let skip = 0;
    let skipBase: string | null = null;
    let prev: string | undefined;
    let due = now();

    // Wait until the next scheduled keystroke; scheduling against a timeline
    // (not a fixed sleep) stops setTimeout overhead from dragging WPM down.
    const wait = async (ms: number) => {
      due += ms;
      const delta = due - now();
      if (delta > 0) await sleep(delta);
      else due = now(); // fell behind (e.g. throttled tab) — don't burst to catch up
    };

    if (this.source.remaining() === null && !full) return 'no-text';

    try {
      while (!this.stopped) {
        await wait(scheduler.nextDelay(prev));
        if (this.stopped) break;
        if (this.source.isFinished?.()) return 'done';

        // Read after waiting so async page re-renders from the last key have landed.
        const live = this.source.remaining();
        if (live !== skipBase) skip = 0;
        const text = live === null ? full.slice(cursor) : live.slice(skip);
        if (!text) return 'done';
        const ch = text[0]!;

        if (shouldTypo(rng, this.opts.accuracy, ch)) {
          await this.injector.type(neighbourKey(rng, ch));
          await wait(scheduler.base * 1.8); // notice the mistake
          if (this.stopped) break;
          await this.injector.backspace();
          await wait(scheduler.base);
          if (this.stopped) break;
        }

        await this.injector.type(ch);
        await settle();
        this.typed++;
        prev = ch;

        if (live === null) {
          cursor++;
        } else if (this.source.remaining() === live) {
          if (/\s/.test(ch)) {
            skip++;
            skipBase = live;
          } else if (++stalls >= maxStalls) {
            return 'stalled';
          }
        } else {
          stalls = 0;
        }
      }
      return 'stopped';
    } finally {
      await this.injector.dispose?.();
    }
  }
}
