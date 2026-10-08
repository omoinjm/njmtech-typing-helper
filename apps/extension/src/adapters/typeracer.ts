import { collapse } from './dom-utils';
import { hostIs, type AdapterDefinition } from './types';

/**
 * typeracer.com: passage lives in `.inputPanel` spans marked unselectable; the
 * input `.txtInput` clears after every word, so progress is tracked with the
 * typer's own cursor (snapshot mode). TypeRacer ignores synthetic keys.
 */
export const typeracer: AdapterDefinition = {
  id: 'typeracer',
  name: 'TypeRacer',
  matches: hostIs('typeracer.com'),
  create: () => {
    const input = () => document.querySelector<HTMLInputElement>('input.txtInput');
    return {
      id: 'typeracer',
      name: 'TypeRacer',
      prefersTrusted: true,
      target: input,
      remaining: () => null,
      snapshot() {
        const panel = document.querySelector('.inputPanel [unselectable="on"]')?.parentElement;
        return panel ? collapse(panel.textContent ?? '') || null : null;
      },
      isFinished: () => !!input()?.disabled && !!document.querySelector('.gameStatusLabel'),
    };
  },
};
