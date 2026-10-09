import { hostIs, type AdapterDefinition } from './types';

/** Class token ending in `-<suffix>`; the prefix (`wb-<hash>-`) is obfuscated and may change per build. */
const hasSuffix = (el: Element, suffix: string) => [...el.classList].some((c) => c.endsWith(`-${suffix}`));

/**
 * 10fastfingers.com (2026 redesign): the passage is `[data-testid="word-box-words"]`,
 * split into runs of text — typed runs end in `-t`, the char under the caret
 * in `-ac`, mistakes in `-e`. Keys go to an unnamed <textarea>. The site
 * ignores synthetic input, so it needs trusted key events (Chromium).
 */
function createModern() {
  const box = () => document.querySelector('[data-testid="word-box-words"]');
  return {
    target: () =>
      box()?.closest('main')?.querySelector<HTMLElement>('textarea') ?? document.querySelector<HTMLElement>('textarea'),
    remaining(): string | null {
      const b = box();
      if (!b) return null;
      const spans = [...b.children];
      const caret = spans.findIndex((s) => hasSuffix(s, 'ac'));
      // No caret but typed runs → test finished.
      if (caret < 0) return spans.some((s) => hasSuffix(s, 't')) ? '' : null;
      return spans.slice(caret).map((s) => s.textContent ?? '').join('');
    },
    snapshot: () => box()?.textContent || null,
  };
}

/** Pre-2026 layout: words are `#row1 span[wordnr]`, current one has `.highlight`; input `#inputfield` clears each word. */
function createLegacy() {
  const input = () => document.querySelector<HTMLInputElement>('#inputfield');
  const words = () => [...document.querySelectorAll('#row1 span[wordnr]')];
  return {
    target: input,
    remaining(): string | null {
      const ws = words();
      const i = ws.findIndex((w) => /(^|\s)highlight/.test(w.className));
      if (i < 0) return null;
      const rest = (ws[i]!.textContent ?? '').slice((input()?.value ?? '').length);
      return [rest, ...ws.slice(i + 1, i + 6).map((w) => w.textContent ?? '')].join(' ');
    },
    snapshot: () => words().map((w) => w.textContent ?? '').join(' ') || null,
    isFinished: () => !!input()?.disabled,
  };
}

export const tenFastFingers: AdapterDefinition = {
  id: '10fastfingers',
  name: '10FastFingers',
  matches: hostIs('10fastfingers.com'),
  create: () => {
    const impl = document.querySelector('[data-testid="word-box-words"]') ? createModern() : createLegacy();
    return { id: '10fastfingers', name: '10FastFingers', prefersTrusted: true, ...impl };
  },
};
