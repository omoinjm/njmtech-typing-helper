# Typing Helper

A browser extension that types automatically on typing-practice websites at a chosen speed (WPM) and accuracy, with human-like timing and typo corrections.

> **Fair use:** meant for practice, demos and testing your own pages. Ranked or multiplayer modes (TypeRacer races, Nitro Type, leaderboards) forbid bots and may ban your account.

## Repository layout

```
apps/
  extension/   WXT browser extension (Chrome, Edge, Firefox; Safari later)
  worker/      Cloudflare Worker API (Hono) — serves remote site rules
  website/     Static landing + privacy pages (GitHub Pages, no build step)
.github/workflows/
  deploy.yml        typecheck → unit tests → build → extension e2e → deploy Worker (main)
  deploy-pages.yml  publish apps/website on changes
  release.yml       on tag v*: build Chrome/Edge/Firefox zips onto one GitHub Release
```

| App | URL |
| --- | --- |
| Website | https://typing.njmtech.co.za |
| API | https://api.typing.njmtech.co.za/api/v1 (`/health`, `/sites`) |

## Supported sites

| Site | How | Notes |
| --- | --- | --- |
| Monkeytype | built-in adapter | reads `#words .word.active`; verified live |
| 10FastFingers | built-in adapter | `#row1 span[wordnr]` + `#inputfield` |
| TypeRacer | built-in adapter | needs **Trusted** mode (Chromium) |
| Keybr, Typing.com, TypingClub, Ratatype | remote site rule + generic | trusted mode preferred |
| Anything else | generic heuristics | finds the one-element-per-character passage; use **Pick text area** if it guesses wrong |

Adapter order: picked element → built-in adapter (if it finds text) → remote site rule from the Worker → generic heuristics. So when a site changes its markup and a built-in adapter breaks, a rule in `apps/worker/src/data/site-rules.ts` fixes it with a Worker deploy instead of an extension release. The extension refreshes rules on startup and every 6 hours, and works offline with whatever it last cached.

## Browsers

| | DOM events | Trusted events |
| --- | --- | --- |
| Chrome / Edge / Brave | ✅ | ✅ via `chrome.debugger` (shows a "being debugged" bar) |
| Firefox | ✅ | ❌ (no debugger API) |
| Safari | planned — `wxt build apps/extension -b safari`, then `xcrun safari-web-extension-converter` on macOS | |

## Usage

1. Open a typing test, click the extension icon.
2. Set **Speed** and **Accuracy**, choose **Key events**:
   - **Auto**: DOM events, switching to trusted events if the page ignores them (Chromium).
   - **DOM**: synthetic keyboard + input events. Works in every browser.
   - **Trusted**: real browser-level key events via the debugger API.
3. Press **Start typing** (or `Alt+Shift+T`). `Esc` stops.
4. If no text is found, press **Pick text area** and click the passage.

## Development

```sh
pnpm install
pnpm dev                 # extension in Chrome with hot reload
pnpm dev:firefox
pnpm dev:worker          # Worker on http://localhost:8787 (set WXT_API_URL to use it, see .env.example)
pnpm typecheck
pnpm test                # unit tests: extension (Vitest + jsdom) and worker (Hono app.request)
pnpm test:extension      # builds, then Playwright drives the extension in Chromium against fixture pages
pnpm build               # extension (Chrome + Firefox) + Worker dry-run bundle
pnpm package:chrome      # / package:edge / package:firefox → apps/extension/.output/*.zip
pnpm deploy              # deploy the Worker (needs CLOUDFLARE_API_TOKEN, see .env.example)
pnpm icons               # re-render PNG icons from apps/extension/assets/icon.svg
```

Load unpacked manually: `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/.output/chrome-mv3`; Firefox: `about:debugging` → Load Temporary Add-on → `apps/extension/.output/firefox-mv2/manifest.json`.

### Releasing

Bump `version` in the root `package.json` (the manifest reads it), then `git tag v<version> && git push origin v<version>`.

### CI secrets

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the Worker deploy. The website needs GitHub Pages enabled with "GitHub Actions" as the source.

## How it works

- `apps/extension/src/adapters/` — per-site readers return the **remaining** text live from the DOM each keystroke, so the typer stays in sync with lazily loaded words. Sites without visible progress use a snapshot + internal cursor.
- `apps/extension/src/engine/` — `Typer` loop, WPM scheduler (timeline-based so timer overhead doesn't drag speed), QWERTY-neighbour typos with backspace.
- `apps/extension/src/inject/dom.ts` — keydown/keypress/keyup + `execCommand('insertText')` (trusted `input` events), falling back to the native value setter so React/Vue inputs update.
- `apps/extension/src/inject/trusted.ts` + `entrypoints/background.ts` — `Input.dispatchKeyEvent` through `chrome.debugger`.
- `apps/worker/` — Hono app with a composition root (`container.ts`) handing routes a `SiteRuleRepository`; currently backed by static data, swappable for KV/D1.

Adding a site: a built-in adapter in `apps/extension/src/adapters/<site>.ts` registered in `index.ts`, or (no release needed) a rule in `apps/worker/src/data/site-rules.ts`.

UI follows the SnipURL visual language (near-black, orange-600 accent, glassy cards); the palette lives in `apps/extension/entrypoints/popup/style.css` and `apps/website/styles.css`.
