import { defineConfig } from 'wxt';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Single source of truth for the release version (release workflows tag v<version>).
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export default defineConfig({
  srcDir: '.',
  zip: {
    // package.json lives at the repo root, so name artifacts explicitly.
    artifactTemplate: `typing-helper-${version}-{{browser}}.zip`,
    sourcesTemplate: `typing-helper-${version}-sources.zip`,
    sourcesRoot: fileURLToPath(new URL('../..', import.meta.url)),
    excludeSources: ['.github/**', 'apps/website/**', 'apps/worker/**', '**/.output/**', '**/test-results/**'],
  },
  manifest: ({ browser }) => ({
    name: 'Typing Helper',
    version,
    description: 'Types automatically on typing-practice websites at a chosen speed and accuracy.',
    // chrome.debugger produces trusted key events (only Chromium has it). It must be a
    // required permission: Chrome rejects `debugger` in optional_permissions.
    permissions: ['storage', 'activeTab', 'alarms', ...(browser === 'firefox' || browser === 'safari' ? [] : ['debugger'])],
    commands: {
      'toggle-typing': {
        suggested_key: { default: 'Alt+Shift+T' },
        description: 'Start / stop typing on the current page',
      },
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'typing-helper@njmtech',
          strict_min_version: '115.0',
          // Only fetches public site rules; nothing about the user leaves the browser.
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
