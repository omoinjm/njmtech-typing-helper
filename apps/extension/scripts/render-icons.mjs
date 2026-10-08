// Renders assets/icon.svg to the PNG sizes the extension manifest and the
// website need, using Playwright's Chromium (already a dev dependency).
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const here = import.meta.dirname;
const svg = await readFile(join(here, '../assets/icon.svg'), 'utf8');
const targets = [
  [join(here, '../public/icon'), (s) => `${s}.png`],
  [join(here, '../../website/assets/icons'), (s) => `icon${s}.png`],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  for (const [dir, name] of targets) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: join(dir, name(size)), omitBackground: true });
  }
}
await browser.close();
console.log('icons rendered');
