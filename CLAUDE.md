# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo contains two unrelated static sites plus a small data-import pipeline — there is no build system, package manager, bundler, or test suite. Everything is served as-is (plain HTML/CSS/JS), presumably via GitHub Pages.

1. **PV Tracker** (`index.html` + `core.js` + `page-*.js`) — the actively developed app. A single-page dashboard for tracking a home solar (PV) installation in Pinggau, Austria: PV yield, grid consumption, self-sufficiency, and cost/savings, backed by Supabase and auto-populated daily from the Growatt inverter API via GitHub Actions.
2. **`riemer.html`** — a large (~2000-line), self-contained personal homepage (cars/Golf 2 G60, MTB, iPhones, printing) with its own Tailwind-based styling. It shares no code, state, or data with the PV Tracker and appears to be an unrelated static page hosted from the same repo. Treat it as isolated — don't assume conventions from one apply to the other.

There's no local dev server or CLI workflow: to "run" the app, open `index.html` in a browser (or serve the directory statically) — it loads `core.js`, then each `page-*.js`, then boots. Changes are validated by reloading the page and clicking through the UI; there is no automated test suite, linter, or build step to run.

## PV Tracker architecture

### Module loading and boot sequence

`index.html` is a shell: sidebar nav + an empty `#page-container` + a shared edit-modal + toast, styled via CSS custom properties (design tokens) defined at the top of its `<style>` block. Scripts load in a fixed order and each page module registers itself into the shared `APP` singleton:

```
core.js            → defines APP (shared state, Supabase, utils, nav)
page-dashboard.js  → defines DASH
page-pv.js         → defines PV and SIM (PV yield + PVGIS simulation)
page-consumption.js  → defines CV  (smart-meter 15-min consumption import)
page-consumption2.js → defines CV2 (meter-reading-based consumption balance)
page-settings.js   → defines SETT
```

On `window.load`:
```js
APP.registerPages();  // each module injects its HTML into #page-container
APP.boot();            // loads localStorage, computes theory, connects Supabase
APP.nav('dashboard');  // navigates only after all page DOM exists
```

Each page module follows the same IIFE shape:
```js
const XXX = (() => {
  const HTML = `...`;           // template string injected into the DOM
  function register() { APP.registerPage('id', { html: HTML, onEnter: loadUI }); }
  return { register, /* public fns referenced by inline onclick= handlers */ };
})();
```
`onEnter` runs every time the page is navigated to (via `APP.nav(id)`), so it's where each module re-renders from current `APP` state. UI wiring is done with inline `onclick="MODULE.fn()"` handlers in the template strings, not event listeners — follow this pattern when adding UI rather than introducing addEventListener-based wiring.

`APP` (`core.js`) is the only source of shared state and exposes a deliberate public API at the bottom of the file (getters for `cfg`, `entries`, `consumption`, `growatt5min`, `theory`, etc., plus mutation helpers like `setCfg`, `setEntries`, `savePv`, `saveCv`, sync/delete helpers, and app-control functions like `nav`/`registerPage`/`toast`). Page modules must go through this API rather than touching module-local state directly.

### Data model and sync

Three logical datasets, each with a Supabase table and a local mirror:

| Data | Supabase table | In-memory (`APP.*`) | localStorage key |
|---|---|---|---|
| PV yield entries (day/week/month) | `pv_entries` | `entries` | `pv_ent` |
| Smart-meter 15-min consumption | `consumption_15min` | `consumption` | `pv_cv` |
| Growatt 5-min power samples | `growatt_5min` | `growatt5min` | *(not cached — always reloaded from Supabase, too large)* |
| Config (site/inverter/pricing) | — | `cfg` | `pv_cfg` |
| Meter readings (CV2 balance) | `meter_readings` | (module-local in `page-consumption2.js`) | — |
| Saved PVGIS scenarios (Simulation) | `pvgis_scenarios` | (module-local in `page-pv.js` / `SIM`) | — |

Sync model, offline-first with debounced push:
- **Writes**: any local mutation calls `savePv()`/`saveCv()`, which persists to `localStorage` and calls `scheduleSync()` — a 1.5s debounce that then upserts all local rows to Supabase in batches (100–200 rows/request, deduped by `id`).
- **Deletes**: `deletePvIds`/`deleteCvIds` delete immediately from Supabase *and* record the id in an in-memory `tombstones`/`cvTombstones` `Set` (persisted to `localStorage`), so a stale Supabase row (e.g. from a slow device) can never resurrect a locally-deleted entry on the next load.
- **Reads**: `initialLoad()` (called from `connectSupabase()` on boot) batch-fetches all three tables (1000 rows/page), merges only *new* ids into local state, and filters out anything present in the tombstone sets.
- IDs are client-generated (`APP.genId()`, a time+random base36 string) for entries created in the UI, and deterministic MD5-derived (`gen_id()` in the Python scripts) for Growatt-imported rows, so re-running the daily import is idempotent (upsert on conflict).

When adding a new synced entity, mirror this pattern: local array + `save*()` (persist + `scheduleSync()`) + row mapper functions + inclusion in `doSync()`/`initialLoad()`, rather than inventing a new sync mechanism.

### Growatt auto-import pipeline

`growatt_import.py` (daily) and `growatt_import_monat.py` (manual, backfill a whole month) both: log into the Growatt API via the `growattServer` package, pull `tlx_data` for a date, write one row to `pv_entries` (daily total) and up to 288 rows to `growatt_5min` (5-min samples) via direct Supabase REST `POST .../rest/v1/<table>` calls with `Prefer: resolution=merge-duplicates` (upsert). Both are invoked by GitHub Actions workflows in `.github/workflows/`:
- `growatt_import.yml` — cron `30 23 * * *` (23:30 UTC daily) + manual dispatch with an optional `import_date`.
- `growatt_import_monat.yml` — manual dispatch only, requires `import_month` (`YYYY-MM`).

Both workflows patch a known type-syntax bug in the pinned `growattServer==2.2.0` package via `sed` before running (see the "Abhängigkeiten installieren und patchen" step) — keep this patch step if bumping the pinned version doesn't already fix it upstream. After a successful import, each workflow rewrites the `?v=<timestamp>` cache-busting query params on the `<script>` tags in `index.html` and commits/pushes directly to the branch the workflow runs on — so `index.html`'s script version query strings are expected to change on every automated run and shouldn't be hand-edited to "fix" them.

Required repo secrets (see `SETUP.md`): `GROWATT_USER`, `GROWATT_PASS`, `SUPABASE_URL`, `SUPABASE_KEY`. `SETUP.md` is written in German, matching the app's UI language — keep any user-facing strings and setup docs in German for consistency.

### Conventions specific to this codebase

- All UI copy, comments in the German areas, and the app's language are German (Austrian usage, e.g. "Bezugspreis", "Einspeisung"). Match this when adding UI text.
- No CSS/JS framework beyond Chart.js and the Supabase JS client (both loaded from CDN in `index.html`). Styling is hand-written CSS using the custom-property design tokens at the top of `index.html`'s `<style>` block (`--bg`, `--tx`, `--ac`, `--gr`, `--rd`, `--bl`, `--pu`, font vars, radii). Reuse existing component classes (`.mc` metric cards, `.cc` chart cards, `.fcard` form cards, `.tcard` tables, `.fbar` filter bars, `.gran-bar`, `.tl-*` timeline range picker, `.badge`, `.modal-*`, `.toast`) instead of inventing new ad hoc styles.
- `APP.FilterBar` (aliased as `APP.Timeline` for backwards compatibility) is the shared date-range/timeline picker component used across pages — reuse it for any new date-range UI rather than building a new one.
- A password gate (`APP.checkPw`, `APP_PW` constant, `pv_unlocked` sessionStorage key) exists in `core.js` but `index.html`'s boot sequence calls `APP.boot()` directly without invoking it — the gate is effectively dormant. Be aware of this if working on auth-related code; don't assume the password screen is actually enforced.
- `core.js` embeds the Supabase project URL and anon key, and `page-settings.js` displays the app password in plaintext in the rendered UI. These are pre-existing choices in this repo (a small self-hosted personal tool), not something to silently "fix" — flag it to the user before changing auth/secrets handling.
