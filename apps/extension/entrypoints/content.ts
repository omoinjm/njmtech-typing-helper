import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { pickAdapter } from '../src/adapters';
import type { SiteAdapter } from '../src/adapters/types';
import { Typer, type Injector, type StopReason } from '../src/engine/typer';
import { DomInjector } from '../src/inject/dom';
import { TrustedInjector } from '../src/inject/trusted';
import type { Message, Status } from '../src/messages';
import { settingsItem } from '../src/settings';
import { toast } from '../src/toast';
import { pickElement } from '../src/picker';
import { siteRulesItem, type SiteRule } from '../src/site-rules';

const REASONS: Record<StopReason, string> = {
  done: 'Finished.',
  stopped: 'Stopped.',
  stalled: 'The page is not accepting keystrokes. Try "Trusted" mode (Chromium) or pick the text area.',
  'no-text': 'No typing text found. Use "Pick text area" in the popup.',
};

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    let typer: Typer | null = null;
    let picked: Element | null = null;
    let detail = '';
    let rules: SiteRule[] = [];
    void siteRulesItem.getValue().then((c) => (rules = c?.rules ?? []));
    siteRulesItem.watch((c) => (rules = c?.rules ?? []));

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    // Let the page re-render after a key, but don't let a throttled rAF stall typing.
    const settle = () =>
      new Promise<void>((r) => {
        const t = setTimeout(r, 25);
        requestAnimationFrame(() => setTimeout(() => (clearTimeout(t), r()), 0));
      });

    async function makeInjector(adapter: SiteAdapter, trusted: boolean): Promise<Injector> {
      if (trusted) {
        const res = await TrustedInjector.attach().catch((e) => ({ ok: false, error: String(e) }));
        if (res.ok) return new TrustedInjector(() => adapter.target());
        toast(`Trusted mode unavailable (${res.error ?? 'unknown'}); using DOM events.`, 4000);
      }
      return new DomInjector(() => adapter.target());
    }

    async function runOnce(adapter: SiteAdapter, trusted: boolean): Promise<StopReason> {
      const s = await settingsItem.getValue();
      const injector = await makeInjector(adapter, trusted);
      typer = new Typer(adapter, injector, { wpm: s.wpm, accuracy: s.accuracy }, {
        rng: Math.random, now: () => performance.now(), sleep, settle,
      });
      return typer.run();
    }

    async function start() {
      if (typer) return;
      const adapter = pickAdapter(location.hostname, picked, rules);
      if (!adapter.remaining() && !adapter.snapshot()) {
        // Child frames without text stay silent; only the top frame reports.
        if (window === window.top) toast(REASONS['no-text'], 4000);
        return;
      }
      const s = await settingsItem.getValue();
      const canTrust = !import.meta.env.FIREFOX && !import.meta.env.SAFARI;
      const trusted = canTrust && (s.mode === 'trusted' || (s.mode === 'auto' && !!adapter.prefersTrusted));

      detail = `Typing on ${adapter.name} at ${s.wpm} WPM${trusted ? ' (trusted)' : ''} — Esc to stop`;
      toast(detail, 0);
      let reason = await runOnce(adapter, trusted);
      // Auto mode: synthetic events were ignored, escalate to trusted events once.
      if (reason === 'stalled' && s.mode === 'auto' && !trusted && canTrust) {
        toast('Page ignored synthetic keys, retrying with trusted mode…', 0);
        reason = await runOnce(adapter, true);
      }
      typer = null;
      detail = REASONS[reason];
      toast(detail, reason === 'done' || reason === 'stopped' ? 2500 : 6000);
    }

    function stop() {
      typer?.stop();
    }

    addEventListener(
      'keydown',
      (e) => {
        if (typer && e.isTrusted && e.key === 'Escape') stop();
      },
      true,
    );

    browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
      switch (msg.type) {
        case 'start':
          void start();
          break;
        case 'stop':
          stop();
          break;
        case 'toggle':
          typer ? stop() : void start();
          break;
        case 'pick':
          if (window !== window.top) break;
          toast('Click the text you want typed (Esc to cancel).', 0);
          void pickElement().then((el) => {
            if (!el) return toast('Picking cancelled.');
            picked = el;
            toast('Text area selected. Press Start or Alt+Shift+T.', 4000);
          });
          break;
        case 'status': {
          if (window !== window.top) return;
          const adapter = pickAdapter(location.hostname, picked, rules);
          const status: Status = {
            running: !!typer,
            adapter: adapter.remaining() || adapter.snapshot() ? adapter.name : 'No text detected',
            detail,
            typed: typer?.typed ?? 0,
          };
          sendResponse(status);
          return true;
        }
      }
    });
  },
});
