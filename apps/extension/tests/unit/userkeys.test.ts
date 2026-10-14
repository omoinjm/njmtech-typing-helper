import { describe, expect, it } from 'vitest';
import { createUserKeys } from '../../src/userkeys';
import type { Injector } from '../../src/engine/typer';

function setup(mode: 'drive' | 'alongside' | 'takeover') {
  let t = 0;
  const target = new EventTarget();
  // The page's own listener. Ours is capture-phase, so it runs first at the target.
  const seen: string[] = [];
  target.addEventListener('keydown', (e) => seen.push((e as KeyboardEvent).key));
  const keys = createUserKeys(mode, {
    now: () => t,
    sleep: async (ms) => void (t += ms),
    target,
    isTrusted: () => true,
  });
  keys.install();
  const press = (key: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key, code: `Key${key.toUpperCase()}`, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
  };
  return { keys, target, seen, press, advance: (ms: number) => void (t += ms) };
}

describe('user keys', () => {
  it('drive: swallows keys and releases one keystroke per key', async () => {
    const { keys, seen, press } = setup('drive');
    const e = press('x');
    expect(e.defaultPrevented).toBe(true);
    expect(seen).toEqual([]);
    press('y');
    expect(await keys.nextKey()).toBe(true);
    expect(await keys.nextKey()).toBe(true);

    const waiting = keys.nextKey();
    press('z');
    expect(await waiting).toBe(true);
  });

  it('drive: ignores auto-repeat for pacing but still swallows it', async () => {
    const { keys, press } = setup('drive');
    expect(press('x', { repeat: true }).defaultPrevented).toBe(true);
    keys.cancel();
    expect(await keys.nextKey()).toBe(false);
  });

  it('drive: cancel unblocks a pending wait', async () => {
    const { keys } = setup('drive');
    const waiting = keys.nextKey();
    keys.cancel();
    expect(await waiting).toBe(false);
  });

  it('alongside: swallows keys without pacing', () => {
    const { seen, press } = setup('alongside');
    expect(press('a').defaultPrevented).toBe(true);
    expect(seen).toEqual([]);
  });

  it('takeover: lets keys through and holds until idle', async () => {
    const { keys, seen, press, advance } = setup('takeover');
    expect(await keys.hold()).toBe(false);
    expect(press('a').defaultPrevented).toBe(false);
    expect(seen).toEqual(['a']);
    advance(300);
    expect(await keys.hold()).toBe(true); // waits out the remaining idle time
    expect(keys.holding).toBe(false);
    expect(await keys.hold()).toBe(false);
  });

  it('leaves Esc, shortcuts and bare modifiers alone', () => {
    const { seen, press } = setup('alongside');
    press('Escape');
    press('r', { ctrlKey: true });
    press('T', { altKey: true, shiftKey: true });
    press('c', { metaKey: true });
    press('Shift');
    expect(seen).toEqual(['Escape', 'r', 'T', 'c', 'Shift']);
  });

  it('does not treat our own injected keys as the user', async () => {
    const { keys, seen, press } = setup('alongside');
    const inner: Injector = { type: async (ch) => void press(ch), backspace: async () => void press('Backspace') };
    const wrapped = keys.wrap(inner);
    await wrapped.type('q');
    await wrapped.backspace();
    expect(seen).toEqual(['q', 'Backspace']);
  });

  it('dispose removes the listeners', () => {
    const { keys, seen, press } = setup('alongside');
    keys.dispose();
    expect(press('a').defaultPrevented).toBe(false);
    expect(seen).toEqual(['a']);
  });
});
