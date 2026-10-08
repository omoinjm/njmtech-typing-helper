import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: { trace: 'retain-on-failure' },
  webServer: { command: 'node tests/e2e/server.mjs', url: 'http://localhost:4599/char-spans.html' },
});
