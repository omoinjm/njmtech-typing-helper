import type { Rng } from './random';

const ROWS = ['1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./'];

const NEIGHBOURS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      let n = '';
      for (const dr of [-1, 0, 1]) {
        const other = ROWS[r + dr];
        if (!other) continue;
        for (const dc of [-1, 0, 1]) {
          if (dr === 0 && dc === 0) continue;
          const k = other[c + dc];
          if (k) n += k;
        }
      }
      map[ch] = n;
    });
  });
  return map;
})();

/** Only letters get typos — mistyping spaces/punctuation confuses word-based sites. */
export function shouldTypo(rng: Rng, accuracy: number, ch: string): boolean {
  if (!/^[a-z]$/i.test(ch)) return false;
  return rng() > Math.min(1, Math.max(0, accuracy));
}

/** A plausible wrong key next to `ch` on a QWERTY layout, preserving case. */
export function neighbourKey(rng: Rng, ch: string): string {
  const lower = ch.toLowerCase();
  const options = (NEIGHBOURS[lower] ?? '').replace(/[^a-z]/g, '');
  if (!options) return lower === 'a' ? 's' : 'a';
  const pick = options[Math.floor(rng() * options.length)]!;
  return ch === lower ? pick : pick.toUpperCase();
}
