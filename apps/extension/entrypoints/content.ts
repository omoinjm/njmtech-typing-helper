import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { pickAdapter } from '../src/adapters';
import type { SiteAdapter } from '../src/adapters/types';
import { Typer, type Injector, type StopReason } from '../src/engine/typer';
import { DomInjector } from '../src/inject/dom';
import { TrustedInjector } from '../src/inject/trusted';
import type { Message, Status } from '../src/messages';
import { settingsItem, type UserKeysMode } from '../src/settings';
import { createUserKeys, type UserKeys } from '../src/userkeys';
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
    // The current run's handler for the user's own keys (null when "off").
    let keys: UserKeys | null = null;
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

    // Why the last trusted attempt couldn't attach, so the final message can say so.
    let trustedError: string | null = null;

    async function makeInjector(adapter: SiteAdapter, trusted: boolean): Promise<{ injector: Injector; trusted: boolean }> {
      if (trusted) {
        const res = await TrustedInjector.attach().catch((e) => ({ ok: false, error: String(e) }));
        if (res.ok) return { injector: new TrustedInjector(() => adapter.target()), trusted: true };
        trustedError = res.error ?? 'unknown error';
        toast(`Trusted keys unavailable (${trustedError}); using DOM events.`, 4000);
      }
      return { injector: new DomInjector(() => adapter.target()), trusted: false };
    }

    function stalledMessage(usedTrusted: boolean, needsTrusted: boolean): string {
      if (needsTrusted && (import.meta.env.FIREFOX || import.meta.env.SAFARI)) {
        return 'This site only accepts real keystrokes, which this browser does not let extensions send. Use Chrome, Edge, Brave or Opera.';
      }
      if (usedTrusted) return 'The page ignored trusted keystrokes too. Try "Pick text area", or report this site.';
      if (trustedError) return `This site needs trusted keys, which are unavailable: ${trustedError}.`;
      if (needsTrusted) return 'This site needs trusted keys. Set "Key events" to Auto or Trusted in the popup.';
      return REASONS.stalled;
    }

    async function runOnce(adapter: SiteAdapter, trusted: boolean): Promise<{ reason: StopReason; usedTrusted: boolean }> {
      const s = await settingsItem.getValue();
      const userKeys = s.userKeys ?? 'off';
      const now = () => performance.now();
      const made = await makeInjector(adapter, trusted);
      keys = userKeys === 'off' ? null : createUserKeys(userKeys, { now, sleep });
      keys?.install();
      const injector = keys ? keys.wrap(made.injector) : made.injector;
      typer = new Typer(adapter, injector, { wpm: s.wpm, accuracy: s.accuracy }, {
        rng: Math.random, now, sleep, settle,
        nextKey: userKeys === 'drive' ? keys!.nextKey : undefined,
        hold: userKeys === 'takeover' ? keys!.hold : undefined,
      });
      try {
        return { reason: await typer.run(), usedTrusted: made.trusted };
      } finally {
        keys?.dispose();
        keys = null;
      }
    }

    function runDetail(adapter: SiteAdapter, wpm: number, trusted: boolean, userKeys: UserKeysMode): string {
      const how = trusted ? ' (trusted)' : '';
      switch (userKeys) {
        case 'drive':
          return `Your keys type on ${adapter.name}${how}. Press any key for the next character, Esc to stop`;
        case 'alongside':
          return `Typing on ${adapter.name} at ${wpm} WPM${how}, ignoring your keys. Esc to stop`;
        case 'takeover':
          return `Typing on ${adapter.name} at ${wpm} WPM${how}, pauses while you type. Esc to stop`;
        default:
          return `Typing on ${adapter.name} at ${wpm} WPM${how} — Esc to stop`;
      }
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

      trustedError = null;
      const userKeys = s.userKeys ?? 'off';
      detail = runDetail(adapter, s.wpm, trusted, userKeys);
      toast(detail, 0);
      let run = await runOnce(adapter, trusted);
      // Auto mode: synthetic events were ignored, escalate to trusted events once.
      // Not when the user drives: the retry would silently wait for keys again.
      if (run.reason === 'stalled' && userKeys !== 'drive' && s.mode === 'auto' && !run.usedTrusted && !trustedError && canTrust) {
        toast('Page ignored synthetic keys, retrying with trusted keys…', 0);
        run = await runOnce(adapter, true);
      }
      typer = null;
      detail = run.reason === 'stalled' ? stalledMessage(run.usedTrusted, !!adapter.prefersTrusted) : REASONS[run.reason];
      toast(detail, run.reason === 'done' || run.reason === 'stopped' ? 2500 : 8000);
    }

    function stop() {
      typer?.stop();
      keys?.cancel();
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
            detail: keys?.holding ? 'Paused while you type…' : detail,
            typed: typer?.typed ?? 0,
          };
          sendResponse(status);
          return true;
        }
      }
    });
  },
});
