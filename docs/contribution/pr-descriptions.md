# PR descriptions for the session sweep

Seven commits on `main` since #125, grouped into the PRs they would become.

---

## PR 1 — fix(indexer): a multi-word query no longer reaches curl as a raw space

**Commit:** `e8b3939e`

### Summary
- The indexer's Jackett/torznab search URL-encodes the query before building
  the curl command, so a space reaches the shell as `%20` instead of a raw
  break that truncates the URL.
- Bumps indexer module to 0.4.0, torrents to 0.3.1, torznab to 0.3.1
  (dependency version drift from the indexer bump).

### Test plan
- [ ] `cargo test -p kroma-module-indexer` passes
- [ ] A two-word search (`The Matrix`) returns results, not a curl error
- [ ] A single-word search still works

---

## PR 2 — fix(web): a search term survives navigation to a detail page and back

**Commit:** `c1e5d19c`

### Summary
- The `/search` route reads `q` and `type` from the URL query string, so the
  term is preserved when the user navigates to a title and comes back.
- `validateDiscoverSearch` centralises the parsing; all navigation calls to
  `/search` now pass `search: { q: '', type: 'all' }` explicitly.
- New test file `search.test.ts` covers the validator.

### Test plan
- [ ] `bun run test clients/web/src/features/requests/search.test.ts` passes
- [ ] Search for "matrix", click a result, press back — the search box still
      says "matrix"
- [ ] Typecheck clean across all workspaces

---

## PR 3 — feat(web): the "+" on a discover card requests in place, not just navigates

**Commit:** `dc40d8c4`

### Summary
- The "+" overlay on a discover card is now a `<button>` that calls
  `createRequest` and optimistically updates the status chip, instead of
  being a visual-only affordance.
- `stopPropagation` prevents the card's navigation when the button is pressed.
- New i18n key `discover.requesting` in en + fr.

### Test plan
- [ ] Click "+" on a discover card — the card does not navigate, the chip
      flips to "requested"
- [ ] Click the card body (not the "+") — navigates to detail as before
- [ ] Lint + typecheck clean

---

## PR 4 — feat(web): quick actions on owned covers mark watched and add to my list

**Commit:** `b945557f`

### Summary
- A quick-action row on owned covers: mark as watched, add to my list.
- Two new i18n key pairs (`cover.markWatched`, `cover.addToList`) in en + fr.

### Test plan
- [ ] Hover an owned cover — the quick-action row appears
- [ ] Click "mark watched" — the watched indicator appears
- [ ] Click "add to list" — the item appears in my list
- [ ] Lint + typecheck clean

---

## PR 5 — feat(desktop): player parity — volume, fullscreen, cursor hide

**Commit:** `a19b2e35`

### Summary
- **Volume:** `TvEngine` gains optional `setVolume(0–1)`; `MpvEngine`
  implements it (0–1 → 0–100). The TV controller wires it when
  `desktop=true`, with mute and re-assert on engine rebuild.
- **Fullscreen:** new `toggle_fullscreen` Tauri command flips the UI window
  to match mpv's fullscreen state. Falls back to the Fullscreen API in a
  browser.
- **Cursor hide:** on desktop with a mouse, the cursor hides after 3s of
  no pointer movement while playing.
- All DOM access goes through `webWindow()` / `webDocument()` from
  `@kroma/ui/kit` — no restricted globals on the TV target.
- Fixes the torrents module manifest test to match the ^0.4.0 indexer
  dependency bumped in PR 1.

### Test plan
- [ ] `bun run typecheck` clean across all 35 workspaces
- [ ] `bun run test` — all 6894 tests pass
- [ ] `bun run check:fix` clean
- [ ] Desktop build: volume slider works, fullscreen toggles, cursor hides
- [ ] TV build: no regressions (volume/fullscreen flags off, no cursor)

---

## PR 6 — feat(acquisition): magnet paste fallback when search finds nothing

**Commit:** `7673b481`

### Summary
- When an interactive or free-text search returns zero releases, the admin
  can paste a magnet URI straight into the import pipeline without leaving
  the request page.
- New `MagnetPasteFallback` component, wired into `RequestFreeSearch` (zero
  releases) and `ResultsDialog` (zero releases).
- Reuses the same `POST /acquisition/add` endpoint the manual grab modal
  uses.
- Two new i18n keys (`requests.magnetFallback`, `requests.magnetAdd`) in
  en + fr.
- Bumps acquisition module to 0.4.0.

### Test plan
- [ ] `bun run test modules/tv.kroma.acquisition` — all 79 tests pass
- [ ] `bun run typecheck --filter @kroma/module-acquisition` clean
- [ ] `bun run check:fix` clean
- [ ] Free search returns 0 results → magnet paste field appears
- [ ] Catalog search returns 0 results → magnet paste field appears in dialog
- [ ] Pasting a valid magnet and clicking "Add" starts the download

---

## PR 7 — fix(i18n): add missing en singular for requests.missingCount

**Commit:** `eea6da18`

### Summary
- The fr locale had a `_one` variant for the singular form of
  `requests.missingCount`; en did not. Adds the en singular to restore
  full parity.
- Full i18n parity sweep confirms: core (2221 = 2221), all 5 module locale
  pairs, and www (353 = 353) are now in sync.

### Test plan
- [ ] `bun run check:fix` clean
- [ ] No missing keys in any locale pair
