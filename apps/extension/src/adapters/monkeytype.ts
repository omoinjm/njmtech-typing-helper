import { hostIs, type AdapterDefinition } from './types';

function letterText(l: Element): string {
  if (l.classList.contains('nlChar')) return '\n';
  if (l.classList.contains('tabChar')) return '\t';
  return l.textContent ?? '';
}

const isTyped = (l: Element) => l.classList.contains('correct') || l.classList.contains('incorrect');
const letters = (w: Element) => [...w.querySelectorAll('letter')].filter((l) => !l.classList.contains('invisible'));
const wordText = (w: Element) => letters(w).map(letterText).join('');

/** monkeytype.com: `#words .word.active letter`, input on hidden `#wordsInput` via beforeinput/input. */
export const monkeytype: AdapterDefinition = {
  id: 'monkeytype',
  name: 'Monkeytype',
  matches: hostIs('monkeytype.com'),
  create: () => ({
    id: 'monkeytype',
    name: 'Monkeytype',
    target: () => document.querySelector<HTMLElement>('#wordsInput'),
    remaining() {
      const words = [...document.querySelectorAll('#words .word')];
      const i = words.findIndex((w) => w.classList.contains('active'));
      if (i < 0) return words.length ? null : '';
      const ls = letters(words[i]!);
      let lastTyped = -1;
      ls.forEach((l, j) => isTyped(l) && (lastTyped = j));
      const rest = ls.slice(lastTyped + 1).map(letterText).join('');
      const next = words.slice(i + 1, i + 6).map(wordText);
      return [rest, ...next].join(' ');
    },
    snapshot: () => [...document.querySelectorAll('#words .word')].map(wordText).join(' ') || null,
    isFinished() {
      const r = document.querySelector<HTMLElement>('#result');
      return !!r && !r.classList.contains('hidden') && getComputedStyle(r).display !== 'none' && !document.querySelector('#words .word.active');
    },
  }),
};
