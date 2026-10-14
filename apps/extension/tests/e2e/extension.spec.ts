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

async function startTyping(wpm: number, userKeys = 'off') {
  await worker.evaluate(async ([wpm, userKeys]) => {
    const chrome = (globalThis as any).chrome;
    await chrome.storage.local.set({ settings: { wpm, accuracy: 1, mode: 'dom', userKeys } });
    const [tab] = await chrome.tabs.query({ active: true });
    await chrome.tabs.sendMessage(tab!.id!, { type: 'start' });
  }, [wpm, userKeys] as const);
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

// page.keyboard sends trusted keys, like a real user.
test('drive: each key the user presses types the next correct character', async () => {
  const page = await context.newPage();
  await page.goto('http://localhost:4599/char-spans.html');
  await page.bringToFront();
  await page.waitForTimeout(300);
  await page.locator('#box').focus();
  await startTyping(60, 'drive');
  await page.waitForTimeout(500);
  await expect(page.locator('#box')).toHaveValue(''); // nothing types on its own
  const passage = 'Pack my box with five dozen liquor jugs.';
  for (let i = 0; i < passage.length; i++) await page.keyboard.press('x', { delay: 20 });
  await expect(page.locator('#result')).toHaveText(/^done \d+$/, { timeout: 10_000 });
  await expect(page.locator('#box')).toHaveValue(passage);
  await page.close();
});

test('alongside: the user mashing keys does not disturb auto-typing', async () => {
  const page = await context.newPage();
  await page.goto('http://localhost:4599/char-spans.html');
  await page.bringToFront();
  await page.waitForTimeout(300);
  await page.locator('#box').focus();
  await startTyping(120, 'alongside');
  for (let i = 0; i < 15; i++) await page.keyboard.press('z', { delay: 60 });
  await expect(page.locator('#result')).toHaveText(/^done \d+$/, { timeout: 30_000 });
  await expect(page.locator('#box')).toHaveValue('Pack my box with five dozen liquor jugs.');
  await page.close();
});
