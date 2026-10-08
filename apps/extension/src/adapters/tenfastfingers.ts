import { hostIs, type AdapterDefinition } from './types';

/** 10fastfingers.com: words are `#row1 span[wordnr]`, current one has `.highlight`; input `#inputfield` clears each word. */
export const tenFastFingers: AdapterDefinition = {
  id: '10fastfingers',
  name: '10FastFingers',
  matches: hostIs('10fastfingers.com'),
  create: () => {
    const input = () => document.querySelector<HTMLInputElement>('#inputfield');
    const words = () => [...document.querySelectorAll('#row1 span[wordnr]')];
    return {
      id: '10fastfingers',
      name: '10FastFingers',
      target: input,
      remaining() {
        const ws = words();
        const i = ws.findIndex((w) => /(^|\s)highlight/.test(w.className));
        if (i < 0) return null;
        const typed = input()?.value ?? '';
        const cur = ws[i]!.textContent ?? '';
        const rest = cur.slice(typed.length);
        return [rest, ...ws.slice(i + 1, i + 6).map((w) => w.textContent ?? '')].join(' ');
      },
      snapshot: () => words().map((w) => w.textContent ?? '').join(' ') || null,
      isFinished: () => !!input()?.disabled,
    };
  },
};
