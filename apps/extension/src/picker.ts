/** Click-to-pick overlay: resolves with the clicked element, or null on Escape. */
export function pickElement(): Promise<Element | null> {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', pointerEvents: 'none', zIndex: '2147483647',
      border: '2px solid #f59e0b', background: 'rgba(245,158,11,.15)', borderRadius: '4px',
    });
    document.documentElement.append(box);

    let hovered: Element | null = null;
    const move = (e: MouseEvent) => {
      hovered = document.elementFromPoint(e.clientX, e.clientY);
      if (!hovered) return;
      const r = hovered.getBoundingClientRect();
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    const finish = (el: Element | null) => {
      removeEventListener('mousemove', move, true);
      removeEventListener('click', click, true);
      removeEventListener('keydown', key, true);
      box.remove();
      resolve(el);
    };
    const click = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      finish(hovered);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    };
    addEventListener('mousemove', move, true);
    addEventListener('click', click, true);
    addEventListener('keydown', key, true);
  });
}
