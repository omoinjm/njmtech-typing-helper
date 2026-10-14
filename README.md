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
| 10FastFingers | built-in adapter | `[data-testid="word-box-words"]` + caret span; **trusted keys only** (Chromium) |
| TypeRacer | built-in adapter | needs **Trusted** mode (Chromium) |
| Keybr, Typing.com, TypingClub, Ratatype | remote site rule + generic | trusted mode preferred |
| Anything else | generic heuristics | finds the one-element-per-character passage; use **Pick text area** if it guesses wrong |

Adapter order: picked element → built-in adapter (if it finds text) → remote site rule from the Worker → generic heuristics. So when a site changes its markup and a built-in adapter breaks, a rule in `apps/worker/src/data/site-rules.ts` fixes it with a Worker deploy instead of an extension release. The extension refreshes rules on startup and every 6 hours, and works offline with whatever it last cached.

## Browsers

| | DOM events | Trusted events |
| --- | --- | --- |
| Chrome / Edge / Brave / Opera | ✅ | ✅ via `chrome.debugger` (shows a "started debugging this browser" bar while typing) |
| Firefox | ✅ | ❌ (no debugger API — trusted-only sites like 10FastFingers and TypeRacer won't work) |
| Safari | planned (see [Safari](#safari-macos)) | |

The Chromium builds request the `debugger` permission at install. It can't be optional: Chrome rejects `debugger` in `optional_permissions`.

## Build & install

Every build lands in `apps/extension/.output/`. Commands run from the repo root; pnpm is the project default, npm works too.

| Browser | pnpm | npm | Output |
| --- | --- | --- | --- |
| Chrome / Brave / Opera | `pnpm exec wxt build apps/extension` | `npx wxt build apps/extension` | `chrome-mv3/` |
| Edge | `pnpm exec wxt build apps/extension -b edge` | `npx wxt build apps/extension -b edge` | `edge-mv3/` |
| Firefox | `pnpm exec wxt build apps/extension -b firefox` | `npx wxt build apps/extension -b firefox` | `firefox-mv2/` |
| Safari | `pnpm exec wxt build apps/extension -b safari` | `npx wxt build apps/extension -b safari` | `safari-mv2/` |
| Chrome + Firefox | `pnpm build:extension` | `npm run build:extension` | both |

With npm: run `npm install` first, don't commit the `package-lock.json` it creates (CI uses `pnpm-lock.yaml`), and run `npm run build:extension && npm run build:worker` instead of `npm run build` (that script calls pnpm).

Prefer not to build? Download `typing-helper-<version>-<browser>.zip` from [GitHub Releases](https://github.com/omoinjm/njmtech-typing-helper/releases), unzip it, and load the folder as below.

### Windows one-liner

In PowerShell:

```powershell
irm https://typing.njmtech.co.za/install.ps1 | iex
```

Or press **Win + R** and paste:

```
powershell -NoExit -c "irm https://typing.njmtech.co.za/install.ps1 | iex"
```

This downloads the latest release and extracts the Chrome (also Brave / Opera), Edge and Firefox builds to `%USERPROFILE%\typing-helper\<browser>`. The zips are deleted afterwards. Load the folder for your browser as below. Re-running the command updates the folders in place, so after an update just click **Reload** on the extension card. If you'd rather read the script first, save it and run it locally:

```powershell
cd $HOME; iwr https://typing.njmtech.co.za/install.ps1 -OutFile install.ps1; powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### Chrome / Brave / Opera

1. Open `chrome://extensions` (`brave://extensions`, `opera://extensions`).
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → choose `apps/extension/.output/chrome-mv3`.
4. Pin **Typing Helper** from the puzzle-piece menu.

### Edge

1. Open `edge://extensions`.
2. Turn on **Developer mode** — in Edge it's in the **left sidebar**, near the bottom.
3. **Load unpacked** (appears at the top) → choose `apps/extension/.output/edge-mv3`.
4. Puzzle-piece icon → eye icon next to **Typing Helper** to show it on the toolbar.

Edge may show a "developer mode extensions" banner on startup — choose **Keep**.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** → choose `apps/extension/.output/firefox-mv2/manifest.json`.

Temporary add-ons are removed when Firefox closes. A permanent install needs a Mozilla-signed build (`pnpm package:firefox` produces the zip and the sources zip AMO asks for).

### Safari (macOS)

```sh
pnpm exec wxt build apps/extension -b safari
xcrun safari-web-extension-converter apps/extension/.output/safari-mv2
```

Build and run the generated Xcode project, then enable the extension in Safari → Settings → Extensions (Develop → Allow Unsigned Extensions while testing). Not tested yet.

### Developing in WSL, browser on Windows

Windows browsers can fail to load unpacked extensions from `\\wsl.localhost\...` paths. Copy the build to a Windows folder and load that instead:

```sh
pnpm exec wxt build apps/extension -b edge   # or no -b for Chrome
rm -rf /mnt/c/Users/<you>/typing-helper-edge
cp -r apps/extension/.output/edge-mv3 /mnt/c/Users/<you>/typing-helper-edge
```

Then load `C:\Users\<you>\typing-helper-edge`.

### Updating

Rebuild (and re-copy if on WSL), then click **Reload** on the extension's card in the browser's extensions page. `pnpm dev` / `pnpm dev:firefox` instead opens a separate browser with the extension loaded and live reload.

## Usage

1. Open a typing test, click the extension icon.
2. Set **Speed** and **Accuracy**, choose **Key events**:
   - **Auto** (recommended): DOM events, or trusted events straight away on sites known to need them; switches to trusted if the page ignores DOM events (Chromium).
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

See [Build & install](#build--install) for per-browser builds and loading unpacked.

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
