const TYPED = /(^|[-_\s])(correct|incorrect|typed|done|complete|completed|error|wrong|right|hit|miss|passed|success|good|bad)([-_\s]|$)/i;
const CURRENT = /(^|[-_\s])(current|active|cursor|caret|focus|focused)([-_\s]|$)/i;
const KEYBOARD = /(^|[-_\s])(key|keys|keyboard|kbd|keycap)([-_\s]|$)/i;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'BUTTON', 'KBD', 'OPTION', 'SVG', 'TEXTAREA', 'INPUT']);

export const normaliseChar = (c: string) => (c === ' ' || c === '␣' ? ' ' : c);

export const classOf = (el: Element) => (typeof el.className === 'string' ? el.className : el.getAttribute('class') ?? '');
export const isTypedMarked = (el: Element) => TYPED.test(classOf(el));
export const isCurrentMarked = (el: Element) => CURRENT.test(classOf(el));

function inKeyboard(el: Element, stop: Element): boolean {
  for (let e: Element | null = el; e && e !== stop; e = e.parentElement) {
    if (KEYBOARD.test(classOf(e)) || e.tagName === 'KBD' || e.tagName === 'BUTTON') return true;
  }
  return false;
}

/** Element with no element children whose text is exactly one character. */
export function isCharLeaf(el: Element): boolean {
  if (el.childElementCount !== 0 || SKIP_TAGS.has(el.tagName.toUpperCase())) return false;
  const t = el.textContent ?? '';
  return t.length === 1;
}

export function charLeaves(root: Element): Element[] {
  return [...root.querySelectorAll('*')].filter(isCharLeaf);
}

function depth(el: Element) {
  let d = 0;
  for (let e: Element | null = el; e; e = e.parentElement) d++;
  return d;
}

/**
 * Find the element holding the passage as one-element-per-character (the
 * pattern nearly every typing site uses to colour letters as you type).
 */
export function findCharContainer(root: Element = document.body, minChars = 10): Element | null {
  const counts = new Map<Element, number>();
  for (const leaf of charLeaves(root)) {
    for (const anc of [leaf.parentElement, leaf.parentElement?.parentElement]) {
      if (anc && root.contains(anc)) counts.set(anc, (counts.get(anc) ?? 0) + 1);
    }
  }
  let best: Element | null = null;
  let bestScore = 0;
  for (const [el, count] of counts) {
    if (count < minChars) continue;
    const leaves = charLeaves(el);
    if (leaves.some((l) => inKeyboard(l, el))) continue;
    const marked = leaves.some((l) => isTypedMarked(l) || isCurrentMarked(l));
    const score = count * (marked ? 2 : 1) + depth(el) * 0.01; // deeper wins ties
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}

export interface CharCell {
  ch: string;
  leaf: Element | null;
}

/** Ordered characters of a char-span container, inserting spaces between word groups when the page has none. */
export function readCells(container: Element): CharCell[] {
  const leaves = charLeaves(container);
  const hasSpaces = leaves.some((l) => /\s/.test(normaliseChar(l.textContent!)));
  const cells: CharCell[] = [];
  let prevParent: Element | null = null;
  for (const leaf of leaves) {
    if (!hasSpaces && prevParent && leaf.parentElement !== prevParent) cells.push({ ch: ' ', leaf: null });
    cells.push({ ch: normaliseChar(leaf.textContent!), leaf });
    prevParent = leaf.parentElement;
  }
  return cells;
}

/** Index of the next char to type from class markers, or null if the page has no markers. */
export function progressIndex(cells: CharCell[]): number | null {
  const current = cells.findIndex((c) => c.leaf && isCurrentMarked(c.leaf));
  if (current >= 0) return current;
  let lastTyped = -1;
  cells.forEach((c, i) => {
    if (c.leaf && isTypedMarked(c.leaf)) lastTyped = i;
  });
  return lastTyped >= 0 ? lastTyped + 1 : null;
}

const TEXT_INPUT = 'textarea, input:not([type]), input[type="text"], input[type="search"], [contenteditable=""], [contenteditable="true"]';

/** Best guess at the element a typing site listens on. */
export function findInputTarget(root: ParentNode = document): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== document.body && active.matches(TEXT_INPUT)) return active;
  const candidates = [...root.querySelectorAll<HTMLElement>(TEXT_INPUT)].filter(
    (el) => !(el as HTMLInputElement).disabled && !(el as HTMLInputElement).readOnly,
  );
  return candidates[0] ?? null;
}

export const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
