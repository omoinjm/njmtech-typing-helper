import { gaussian, type Rng } from './random';

export interface SchedulerOptions {
  wpm: number;
  /** Relative standard deviation of per-key delay (0 = metronome). */
  jitter?: number;
}

/** Standard "word" = 5 characters. */
export function baseDelayMs(wpm: number): number {
  return 60000 / (Math.max(1, wpm) * 5);
}

/**
 * Per-character delays averaging to the target WPM, with gaussian jitter and a
 * short hesitation after sentence punctuation. Multipliers are normalised so the
 * long-run mean stays at the base delay.
 */
export function createScheduler(opts: SchedulerOptions, rng: Rng) {
  const base = baseDelayMs(opts.wpm);
  const jitter = opts.jitter ?? 0.25;

  return {
    base,
    nextDelay(prev: string | undefined): number {
      let factor = 1 + gaussian(rng) * jitter;
      factor = Math.min(2, Math.max(0.35, factor));
      if (prev && '.!?;:'.includes(prev)) factor *= 1.5;
      return base * factor;
    },
  };
}
