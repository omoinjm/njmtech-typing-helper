import { chromium, expect, test, type BrowserContext, type Worker } from '@playwright/test';
import { resolve } from 'node:path';

const EXT = resolve(import.meta.dirname, '../../.output/chrome-mv3');
let context: BrowserContext;
let worker: Worker;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium', // extensions need full Chromium, not headless-shell
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
});

test.afterAll(() => context.close());

async function startTyping(wpm: number) {
  await worker.evaluate(async (wpm) => {
    const chrome = (globalThis as any).chrome;
    await chrome.storage.local.set({ settings: { wpm, accuracy: 1, mode: 'dom' } });
    const [tab] = await chrome.tabs.query({ active: true });
    await chrome.tabs.sendMessage(tab!.id!, { type: 'start' });
  }, wpm);
}

for (const [fixture, wpm] of [
  ['char-spans.html', 120],
  ['word-groups.html', 90],
] as const) {
  test(`types ${fixture} at ~${wpm} WPM`, async () => {
    const page = await context.newPage();
    await page.goto(`http://localhost:4599/${fixture}`);
    await page.bringToFront();
    await page.waitForTimeout(300); // content script at document_idle
    await startTyping(wpm);
    await expect(page.locator('#result')).toHaveText(/^done \d+$/, { timeout: 30_000 });
    const measured = Number((await page.locator('#result').textContent())!.split(' ')[1]);
    expect(measured).toBeGreaterThan(wpm * 0.8);
    expect(measured).toBeLessThan(wpm * 1.2);
    await page.close();
  });
}
