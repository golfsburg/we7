# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo is **PV Tracker**, a single-page dashboard for tracking a home solar (PV) installation in Pinggau, Austria (installed 2026-06-01): PV yield, grid consumption, self-sufficiency, amortization, and cost/savings — backed by Supabase and auto-populated daily from the Growatt inverter API via GitHub Actions. There is no build system, package manager, bundler, or test suite — everything is served as-is (plain HTML/CSS/JS) via GitHub Pages at the custom domain in `CNAME` (`pv.riemer.co`).

The app is distributed as a licensed tool ("RIEMER Toolbox", see `LICENSE` — proprietary, viewing the source is not a grant to use it) and is gated behind a license-key check (`lizenz-gate.js`) before it starts. See "Lizenz-Gate" below.

There's no local dev server or CLI workflow: to "run" the app, open `index.html` in a browser (or serve the directory statically) — it loads `lizenz-gate.js`, then `core.js`, then each `page-*.js`, then boots once a valid license is confirmed. Changes are validated by reloading the page and clicking through the UI; there is no automated test suite, linter, or build step to run.

## PV Tracker architecture

### Module loading and boot sequence

`index.html` is a shell: sidebar nav + an empty `#page-container` + a shared edit-modal + toast, styled via CSS custom properties (design tokens) defined at the top of its `<style>` block (light/dark variants — see "Theme" below). Scripts load in a fixed order and each page module registers itself into the shared `APP` singleton:

```
lizenz-gate.js      → defines LIZENZ (license-key gate, loads before everything else)
core.js             → defines APP (shared state, Supabase, utils, nav)
page-dashboard.js   → defines DASH
page-pv.js          → defines PV and SIM (PV yield + PVGIS simulation)
page-consumption.js   → defines CV  (smart-meter 15-min consumption import)
page-consumption2.js  → defines CV2 (meter-reading-based consumption balance — also the
                         source of truth for self-consumption, see below)
page-settings.js   → defines SETT
page-analyse.js    → defines AU (Autarkie), AMOR (Amortisation), PROF (Tagesprofile)
```

On `window.load`:
```js
LIZENZ.gate(() => {
  APP.registerPages();  // each module injects its HTML into #page-container
  APP.boot();            // loads storage, connects supabase
  updateThemeUI();
  const startPage = (location.hash || '').replace('#', '') || 'dashboard';
  APP.nav(startPage);    // navigate AFTER pages exist in DOM; also supports deep-linking via #hash
});
```
Everything is wrapped in `LIZENZ.gate(callback)` — the app (pages, Supabase connection) only starts once a valid license key passes `lizenz-gate.js`'s check. Don't remove this wrapper when touching boot code.

Each page module follows the same IIFE shape:
```js
const XXX = (() => {
  const HTML = `...`;           // template string injected into the DOM
  function register() { APP.registerPage('id', { html: HTML, onEnter: loadUI }); }
  return { register, /* public fns referenced by inline onclick= handlers */ };
})();
```
`onEnter` runs every time the page is navigated to (via `APP.nav(id)`), so it's where each module re-renders from current `APP` state. UI wiring is done with inline `onclick="MODULE.fn()"` handlers in the template strings, not event listeners — follow this pattern when adding UI rather than introducing addEventListener-based wiring. `APP.nav(id)` also keeps `location.hash` in sync (`history.replaceState`), so every page is deep-linkable (`#autarkie`, `#amortisation`, etc.).

`APP` (`core.js`) is the only source of shared state and exposes a deliberate public API at the bottom of the file (getters for `cfg`, `entries`, `consumption`, `growatt5min`, `theory`, etc., plus mutation helpers like `setCfg`, `setEntries`, `savePv`, `saveCv`, sync/delete helpers, and app-control functions like `nav`/`registerPage`/`toast`). Page modules must go through this API rather than touching module-local state directly. Several newer modules (`page-dashboard.js`, `page-settings.js`, `core.js` itself) guard calls into `CV2` with `typeof CV2 !== 'undefined'`, since module load order makes `CV2` a plain global rather than something `APP` re-exports — follow the same guard if you add a new cross-module dependency on another page's public functions.

### Data model and sync

Datasets, each with a Supabase table and (mostly) a local mirror:

| Data | Supabase table | In-memory (`APP.*`) | localStorage key |
|---|---|---|---|
| PV yield entries (day/week/month) | `pv_entries` | `entries` | `pv_ent` |
| Smart-meter 15-min consumption | `consumption_15min` | `consumption` | `pv_cv` |
| Growatt 5-min power samples | `growatt_5min` | `growatt5min` | *(not cached — always reloaded from Supabase, too large; `page-pv.js` and `page-analyse.js`'s Tagesprofile both batch-load it directly via `APP.sbClient`)* |
| Config (site/inverter/pricing) | — | `cfg` | `pv_cfg` |
| Meter readings (CV2 balance; **also drives self-consumption app-wide**, see below) | `meter_readings` | module-local in `page-consumption2.js` (`readings`) | `cv2_readings` + `cv2_tombstones` |
| Saved PVGIS scenarios (Simulation) | `pvgis_scenarios` | module-local in `page-pv.js` / `SIM` | — |

Sync model, offline-first with debounced push:
- **Writes**: any local mutation calls `savePv()`/`saveCv()` (or CV2's `saveReadings()`), which persists to `localStorage` and calls `scheduleSync()` — a 1.5s debounce that then upserts all local rows to Supabase in batches (100–200 rows/request, deduped by `id`).
- **Deletes**: `deletePvIds`/`deleteCvIds` (core.js) and CV2's own delete functions all delete immediately from Supabase *and* record the id in an in-memory tombstone `Set` (`tombstones`/`cvTombstones` in core.js, `cv2Tombstones` in `page-consumption2.js`, each persisted to `localStorage`), so a stale Supabase row (e.g. from a slow device) can never resurrect a locally-deleted entry on the next load.
- **Reads**: `initialLoad()` (called from `connectSupabase()` on boot) batch-fetches `pv_entries`/`consumption_15min` (1000 rows/page), merges only *new* ids into local state, filters out anything present in the tombstone sets — and, after that, also calls `CV2.loadReadings(false)` unconditionally, so meter readings are available at boot even if the user never opens the Verbrauchsbilanz page (needed because Dashboard/Autarkie/Amortisation/Settings all depend on `CV2.getMeterPeriods()`).
- IDs are client-generated (`APP.genId()`, a time+random base36 string) for entries created in the UI, and deterministic MD5-derived (`gen_id()` in the Python scripts) for Growatt-imported rows, so re-running the daily import is idempotent (upsert on conflict).

When adding a new synced entity, mirror this pattern: local array + `save*()` (persist + `scheduleSync()`) + row mapper functions + inclusion in `doSync()`/`initialLoad()`, plus a tombstone set for deletes — rather than inventing a new sync mechanism.

### Self-consumption / Autarkie model

There is **no percentage estimate anymore** — `cfg.selfPct` was removed, and `calcDirect()`/`calcEuro()` in `core.js` are now dead code (still defined and exported, but no longer called anywhere; a grep confirms it before you reach for them). Self-consumption is derived exclusively from measured data via `CV2.getMeterPeriods()` (`page-consumption2.js`), used by `core.js`'s `updateSidebar()`, every chart in `page-dashboard.js`, `page-settings.js`'s read-only self-consumption display, and `page-analyse.js`.

The key subtlety `getMeterPeriods()` encodes: `meter_readings.solar_kwh` is **not** the PV yield — it's a different meter on the installation (its own feed-in/production counter, read manually). The actual PV yield is `pv_entries` (populated by the Growatt API import). So `getMeterPeriods()` takes the day-to-day consumption/feed-in differences from `meter_readings` (an accurate, real cumulative-counter diff) and overrides their `solar`/`pvKwh` field with `APP.getMonthPv()`'s sum from `pv_entries` for the matching months. Self-consumption for a period is then `max(0, pvKwh - feed)` — PV yield minus measured grid feed-in. If `getMeterPeriods()` has no overlapping period for a given range, self-consumption is `0`, not a guess.

**Install-date cutoff**: `'2026-06-01'` (the PV installation date) is used everywhere to exclude unrelated/test data from before the system existed — but it's a **duplicated literal**, not a shared constant: `core.js` (`INSTALL`), `page-dashboard.js` (`INSTALL`), `page-consumption2.js` (`INSTALL_DATE`), and `page-analyse.js` (`INSTALL`, 3×) each hardcode it separately. If this date ever needs to change, grep for `2026-06-01` and update every occurrence — there's no single source of truth for it yet.

### Growatt auto-import pipeline

`growatt_import.py` (daily) and `growatt_import_monat.py` (manual, backfill a whole month) both: log into the Growatt API via the `growattServer` package, pull `tlx_data` for a date, write one row to `pv_entries` (daily total) and up to 288 rows to `growatt_5min` (5-min samples) via direct Supabase REST `POST .../rest/v1/<table>` calls with `Prefer: resolution=merge-duplicates` (upsert). Both are invoked by GitHub Actions workflows in `.github/workflows/`, both with `permissions: contents: write` (needed to push the cache-bust commit back):
- `growatt_import.yml` — cron `30 23 * * *` (23:30 UTC daily) + manual dispatch with an optional `import_date`.
- `growatt_import_monat.yml` — manual dispatch only, requires `import_month` (`YYYY-MM`).

Both workflows patch a known type-syntax bug in the pinned `growattServer==2.2.0` package via `sed` before running (see the "Abhängigkeiten installieren und patchen" step) — keep this patch step if bumping the pinned version doesn't already fix it upstream. After a successful import, each workflow rewrites the `?v=<timestamp>` cache-busting query params on the `<script>` tags in `index.html` (now including `lizenz-gate.js` and `page-analyse.js`) and commits/pushes directly to the branch the workflow runs on — so `index.html`'s script version query strings are expected to change on every automated run and shouldn't be hand-edited to "fix" them.

Required repo secrets (see `SETUP.md`): `GROWATT_USER`, `GROWATT_PASS`, `SUPABASE_URL`, `SUPABASE_KEY`. `SETUP.md` is written in German, matching the app's UI language — keep any user-facing strings and setup docs in German for consistency.

### Conventions specific to this codebase

- All UI copy, comments in the German areas, and the app's language are German (Austrian usage, e.g. "Bezugspreis", "Einspeisung"). Match this when adding UI text.
- No CSS/JS framework beyond Chart.js and the Supabase JS client (both loaded from CDN in `index.html`); fonts come from the RIEMER Toolbox's own font CDN (`golfsburg.github.io/riemer-toolbox/fonts/fonts.css`), not Google Fonts. Styling is hand-written CSS using the custom-property design tokens at the top of `index.html`'s `<style>` block (`--bg`, `--tx`, `--ac`, `--gr`, `--rd`, `--bl`, `--pu`, font vars, radii). Reuse existing component classes (`.mc` metric cards, `.cc` chart cards, `.fcard` form cards, `.tcard` tables, `.fbar` filter bars, `.gran-bar`, `.tl-*` timeline range picker, `.badge`, `.modal-*`, `.toast`) instead of inventing new ad hoc styles.
- **Theme**: light/dark is driven by `document.documentElement`'s `data-theme` attribute (`"light"`/`"dark"`), set from `localStorage['pv_theme']` or `prefers-color-scheme` on first paint (inline anti-flash script in `index.html`'s `<head>`), toggled via `APP.toggleTheme()`. Every token in the `:root` block has a light-mode override — add both when introducing a new color token.
- `APP.FilterBar` (aliased as `APP.Timeline` for backwards compatibility) is the shared date-range/timeline picker component used across pages — reuse it for any new date-range UI rather than building a new one. It now also maintains a **global selected range** shared across every `FilterBar` instance on the page: picking a range on one page's timeline becomes the next page's default range too (`fire()` writes `globalFrom`/`globalTo`; `create()` prefers them over the container's own `opts.defaultFrom`/the data's min/max). Pass `opts.defaultFrom` for a page-specific lower bound (e.g. the install date) that applies only until a global range is set.
- There are two unrelated "password" concepts — don't confuse them: `lizenz-gate.js`'s `LIZENZ.gate()` is the real, enforced gate (license key, blocks app start — see below). `core.js`'s `APP.checkPw`/`APP_PW` constant/`pv_unlocked` sessionStorage key is a separate, older in-app password screen that `index.html`'s boot sequence never invokes — it's dormant dead code, except that `APP_PW` (via `APP.isCorrectPw()`) is still used as the confirmation password for the "delete all data" actions in `page-pv.js`/`page-consumption.js`.
- `core.js` embeds the Supabase project URL and anon key, and `page-settings.js` used to display the app password in plaintext — these are pre-existing choices in this repo, not something to silently "fix"; flag it to the user before changing auth/secrets handling.

### Lizenz-Gate (RIEMER Toolbox)

`lizenz-gate.js` defines `LIZENZ` and loads before `core.js`. `index.html`'s `load` handler starts the app only via `LIZENZ.gate(() => { … })` — pages are registered and Supabase is connected only after a valid license key (`RITL-XXXX-XXXX-XXXX-XXXX`, tool id `pv-tracker`) is confirmed. The check hits the `license-check` Edge Function in a **separate** Supabase project ("RIEMER-Lizenzen" — not the We7-Tracker project this app's own data lives in). Licenses are managed via the RIEMER Toolbox admin page (`golfsburg/riemer-toolbox` repo, `lizenz/admin.html`). Users can sign out by appending `?abmelden` to the URL. Don't remove the gate call when touching boot code.
