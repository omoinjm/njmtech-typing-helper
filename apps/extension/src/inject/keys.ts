export interface KeyInfo {
  key: string;
  code: string;
  keyCode: number;
  shift: boolean;
  /** Text the key inserts, if any. */
  text: string;
}

const SHIFTED: Record<string, string> = {
  '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  _: '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`',
};

const PUNCT: Record<string, [code: string, keyCode: number]> = {
  '-': ['Minus', 189], '=': ['Equal', 187], '[': ['BracketLeft', 219], ']': ['BracketRight', 221],
  '\\': ['Backslash', 220], ';': ['Semicolon', 186], "'": ['Quote', 222], ',': ['Comma', 188],
  '.': ['Period', 190], '/': ['Slash', 191], '`': ['Backquote', 192],
};

export const BACKSPACE: KeyInfo = { key: 'Backspace', code: 'Backspace', keyCode: 8, shift: false, text: '' };

/** Map a character to the US-QWERTY key that produces it. Unknown chars get a bare key with text. */
export function keyFor(ch: string): KeyInfo {
  if (ch === '\n') return { key: 'Enter', code: 'Enter', keyCode: 13, shift: false, text: '\r' };
  if (ch === ' ') return { key: ' ', code: 'Space', keyCode: 32, shift: false, text: ' ' };
  if (ch === '\t') return { key: 'Tab', code: 'Tab', keyCode: 9, shift: false, text: '\t' };
  if (/^[a-z]$/i.test(ch)) {
    const upper = ch.toUpperCase();
    return { key: ch, code: `Key${upper}`, keyCode: upper.charCodeAt(0), shift: ch !== ch.toLowerCase(), text: ch };
  }
  if (/^[0-9]$/.test(ch)) return { key: ch, code: `Digit${ch}`, keyCode: ch.charCodeAt(0), shift: false, text: ch };
  const base = SHIFTED[ch];
  if (base) {
    const inner = keyFor(base);
    return { ...inner, key: ch, shift: true, text: ch };
  }
  const p = PUNCT[ch];
  if (p) return { key: ch, code: p[0], keyCode: p[1], shift: false, text: ch };
  return { key: ch, code: '', keyCode: 0, shift: false, text: ch };
}
