import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { Message } from '../src/messages';
import { BACKSPACE, keyFor } from '../src/inject/keys';
import { REFRESH_MINUTES, refreshSiteRules } from '../src/site-rules';

// chrome.debugger isn't in the cross-browser typings; it only exists on Chromium.
type Debuggee = { tabId: number };
interface DebuggerApi {
  attach(target: Debuggee, version: string): Promise<void>;
  detach(target: Debuggee): Promise<void>;
  sendCommand(target: Debuggee, method: string, params?: object): Promise<unknown>;
  onDetach: { addListener(cb: (source: Debuggee) => void): void };
}

export default defineBackground(() => {
  const dbg = (browser as unknown as { debugger?: DebuggerApi }).debugger;
  const attached = new Set<number>();

  // Site rules from the Worker: refresh on install/startup and every few hours.
  browser.runtime.onInstalled.addListener(() => void refreshSiteRules());
  browser.runtime.onStartup.addListener(() => void refreshSiteRules());
  browser.alarms.create('refresh-site-rules', { periodInMinutes: REFRESH_MINUTES });
  browser.alarms.onAlarm.addListener((a) => a.name === 'refresh-site-rules' && void refreshSiteRules());

  dbg?.onDetach.addListener(({ tabId }) => attached.delete(tabId));

  async function attach(tabId: number) {
    if (!dbg) throw new Error('not supported in this browser');
    if (!(await browser.permissions.contains({ permissions: ['debugger'] as never[] }))) {
      throw new Error('debugger permission not granted — start once from the popup');
    }
    if (!attached.has(tabId)) {
      await dbg.attach({ tabId }, '1.3');
      attached.add(tabId);
    }
  }

  async function sendKey(tabId: number, ch: string) {
    const k = ch === '\b' ? BACKSPACE : keyFor(ch);
    const base = {
      key: k.key,
      code: k.code,
      windowsVirtualKeyCode: k.keyCode,
      nativeVirtualKeyCode: k.keyCode,
      modifiers: k.shift ? 8 : 0,
    };
    const target = { tabId };
    await dbg!.sendCommand(target, 'Input.dispatchKeyEvent', k.text
      ? { ...base, type: 'keyDown', text: k.text, unmodifiedText: k.text }
      : { ...base, type: 'rawKeyDown' });
    await dbg!.sendCommand(target, 'Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
  }

  browser.runtime.onMessage.addListener((msg: Message, sender) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    switch (msg.type) {
      case 'trusted:attach':
        return attach(tabId).then(
          () => ({ ok: true }),
          (e: Error) => ({ ok: false, error: e.message }),
        );
      case 'trusted:key':
        return sendKey(tabId, msg.ch).then(() => ({ ok: true }));
      case 'trusted:detach':
        if (!attached.has(tabId)) return Promise.resolve({ ok: true });
        attached.delete(tabId);
        return dbg!.detach({ tabId }).then(() => ({ ok: true }), () => ({ ok: true }));
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-typing') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) await browser.tabs.sendMessage(tab.id, { type: 'toggle' } satisfies Message).catch(() => {});
  });
});
