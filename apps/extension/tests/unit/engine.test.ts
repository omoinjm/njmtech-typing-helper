import { describe, expect, it } from 'vitest';
import { baseDelayMs, createScheduler } from '../../src/engine/scheduler';
import { neighbourKey, shouldTypo } from '../../src/engine/errors';
import { seededRng } from '../../src/engine/random';
import { Typer, type Injector, type TextSource } from '../../src/engine/typer';

function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

class Recorder implements Injector {
  out = '';
  keys: string[] = [];
  async type(ch: string) {
    this.out += ch;
    this.keys.push(ch);
  }
  async backspace() {
    this.out = this.out.slice(0, -1);
    this.keys.push('⌫');
  }
}

describe('scheduler', () => {
  it('converts WPM to a 5-char-word delay', () => {
    expect(baseDelayMs(60)).toBe(200);
    expect(baseDelayMs(120)).toBe(100);
  });

  it('averages close to the base delay', () => {
    const s = createScheduler({ wpm: 80 }, seededRng(1));
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += s.nextDelay('a');
    expect(sum / 5000).toBeGreaterThan(s.base * 0.95);
    expect(sum / 5000).toBeLessThan(s.base * 1.05);
  });
});

describe('errors', () => {
  it('never typos at 100% accuracy or on non-letters', () => {
    const rng = seededRng(2);
    for (let i = 0; i < 1000; i++) expect(shouldTypo(rng, 1, 'a')).toBe(false);
    for (let i = 0; i < 1000; i++) expect(shouldTypo(rng, 0, ' ')).toBe(false);
  });

  it('picks an adjacent letter with matching case', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 50; i++) {
      expect('qwszx').toContain(neighbourKey(rng, 'a'));
      expect(neighbourKey(rng, 'G')).toMatch(/^[A-Z]$/);
    }
  });
});

describe('Typer', () => {
  const text = 'the quick brown fox';

  it('types a snapshot passage with an internal cursor', async () => {
    const rec = new Recorder();
    const src: TextSource = { remaining: () => null, snapshot: () => text };
    const reason = await new Typer(src, rec, { wpm: 60, accuracy: 1 }, { rng: seededRng(4), ...fakeClock() }).run();
    expect(reason).toBe('done');
    expect(rec.out).toBe(text);
  });

  it('follows live remaining text and hits the target WPM', async () => {
    const rec = new Recorder();
    const clock = fakeClock();
    const src: TextSource = { remaining: () => text.slice(rec.out.length), snapshot: () => text };
    await new Typer(src, rec, { wpm: 60, accuracy: 1 }, { rng: seededRng(5), ...clock }).run();
    expect(rec.out).toBe(text);
    const wpm = text.length / 5 / (clock.now() / 60000);
    expect(wpm).toBeGreaterThan(50);
    expect(wpm).toBeLessThan(70);
  });

  it('corrects typos with backspace and still ends with the right text', async () => {
    const rec = new Recorder();
    const src: TextSource = { remaining: () => null, snapshot: () => text };
    await new Typer(src, rec, { wpm: 100, accuracy: 0.7 }, { rng: seededRng(6), ...fakeClock() }).run();
    expect(rec.out).toBe(text);
    expect(rec.keys).toContain('⌫');
  });

  it('does not retype spaces the page never marks as typed', async () => {
    const rec = new Recorder();
    // Progress only counts letters, like word-grouped sites with no space elements.
    const src: TextSource = {
      remaining: () => {
        const letters = rec.out.replace(/ /g, '').length;
        let i = 0;
        for (let n = 0; n < letters; i++) if (text[i] !== ' ') n++;
        return text.slice(i);
      },
      snapshot: () => text,
    };
    expect(await new Typer(src, rec, { wpm: 60, accuracy: 1 }, { rng: seededRng(9), ...fakeClock() }).run()).toBe('done');
    expect(rec.out).toBe(text);
  });

  it('reports stalled when the page ignores keystrokes', async () => {
    const src: TextSource = { remaining: () => text, snapshot: () => text };
    const reason = await new Typer(src, new Recorder(), { wpm: 100, accuracy: 1 }, { rng: seededRng(7), ...fakeClock() }).run();
    expect(reason).toBe('stalled');
  });

  it('stops on request', async () => {
    const rec = new Recorder();
    const src: TextSource = { remaining: () => null, snapshot: () => text };
    const typer = new Typer(src, rec, { wpm: 100, accuracy: 1 }, {
      rng: seededRng(8),
      ...fakeClock(),
      settle: async () => {
        if (rec.out.length === 3) typer.stop();
      },
    });
    expect(await typer.run()).toBe('stopped');
    expect(rec.out).toBe('the');
  });
});
