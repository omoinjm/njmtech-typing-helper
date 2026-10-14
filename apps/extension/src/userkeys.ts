import type { Injector } from './engine/typer';
import type { UserKeysMode } from './settings';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'OS', 'Hyper', 'Super']);

export interface UserKeys {
  install(): void;
  /** Unblocks any pending nextKey/hold; the run is ending. */
  cancel(): void;
  dispose(): void;
  /** Wraps an injector so its own (trusted) key events aren't mistaken for the user's. */
  wrap(injector: Injector): Injector;
  nextKey(): Promise<boolean>;
  hold(): Promise<boolean>;
  readonly holding: boolean;
}

export interface UserKeysDeps {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  target?: EventTarget;
  /** takeover: how long the user must be idle before auto-typing resumes. */
  idleMs?: number;
  /** Tests only: jsdom can't create trusted events. */
  isTrusted?: (e: Event) => boolean;
}

/**
 * Handles the user's own keys during a run. Debugger-injected keys arrive as
 * isTrusted too, so anything fired while our injector is mid-keystroke is ours.
 */
export function createUserKeys(mode: Exclude<UserKeysMode, 'off'>, deps: UserKeysDeps): UserKeys {
  const { now, sleep, target = window, idleMs = 800, isTrusted = (e: Event) => e.isTrusted } = deps;
  let injecting = 0;
  let pending = 0;
  let cancelled = false;
  let holding = false;
  let lastKey = -Infinity;
  let waiter: ((ok: boolean) => void) | null = null;
  // Keys whose keydown we swallowed; their keypress/keyup are swallowed too.
  const swallowed = new Set<string>();

  const isUserKey = (e: KeyboardEvent) =>
    isTrusted(e) && injecting === 0 && e.key !== 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey && !MODIFIERS.has(e.key);

  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const onKeyDown = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (!isUserKey(ke)) return;
    if (mode === 'takeover') {
      lastKey = now();
      return;
    }
    swallow(ke);
    swallowed.add(ke.code);
    if (mode !== 'drive' || ke.repeat) return;
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(true);
    } else {
      pending++;
    }
  };

  const onKeyPressOrUp = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (!isTrusted(ke) || injecting > 0 || !swallowed.has(ke.code)) return;
    swallow(ke);
    if (ke.type === 'keyup') swallowed.delete(ke.code);
  };

  const mark = async <T>(fn: () => Promise<T>): Promise<T> => {
    injecting++;
    try {
      return await fn();
    } finally {
      injecting--;
    }
  };

  const cancel = () => {
    cancelled = true;
    const w = waiter;
    waiter = null;
    w?.(false);
  };

  return {
    install() {
      target.addEventListener('keydown', onKeyDown, true);
      target.addEventListener('keypress', onKeyPressOrUp, true);
      target.addEventListener('keyup', onKeyPressOrUp, true);
    },
    cancel,
    dispose() {
      cancel();
      target.removeEventListener('keydown', onKeyDown, true);
      target.removeEventListener('keypress', onKeyPressOrUp, true);
      target.removeEventListener('keyup', onKeyPressOrUp, true);
    },
    wrap: (injector) => ({
      type: (ch) => mark(() => injector.type(ch)),
      backspace: () => mark(() => injector.backspace()),
      dispose: () => injector.dispose?.() ?? Promise.resolve(),
    }),
    async nextKey() {
      if (cancelled) return false;
      if (pending > 0) {
        pending--;
        return true;
      }
      return new Promise<boolean>((r) => (waiter = r));
    },
    async hold() {
      let waited = false;
      while (!cancelled) {
        const left = lastKey + idleMs - now();
        if (left <= 0) break;
        holding = waited = true;
        await sleep(Math.min(left, 50));
      }
      holding = false;
      return waited;
    },
    get holding() {
      return holding;
    },
  };
}
