import { browser } from 'wxt/browser';
import type { Injector } from '../engine/typer';
import type { Message } from '../messages';

/**
 * Content-script side of trusted typing: forwards each key to the background,
 * which replays it through chrome.debugger so the page sees isTrusted=true events.
 */
export class TrustedInjector implements Injector {
  constructor(private getTarget: () => HTMLElement | null) {}

  static async attach(): Promise<{ ok: boolean; error?: string }> {
    return browser.runtime.sendMessage({ type: 'trusted:attach' } satisfies Message);
  }

  private focus() {
    const t = this.getTarget();
    if (t && document.activeElement !== t) t.focus({ preventScroll: true });
  }

  async type(ch: string) {
    this.focus();
    await browser.runtime.sendMessage({ type: 'trusted:key', ch } satisfies Message);
  }

  async backspace() {
    this.focus();
    await browser.runtime.sendMessage({ type: 'trusted:key', ch: '\b' } satisfies Message);
  }

  async dispose() {
    await browser.runtime.sendMessage({ type: 'trusted:detach' } satisfies Message);
  }
}
