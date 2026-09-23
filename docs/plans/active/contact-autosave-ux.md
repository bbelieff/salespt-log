# contact-autosave-ux (2026-09-24)

## Findings

- Contact felt slow for two compounding reasons, not one:
  1. `LoadingProvider` counted **every** pending mutation as blocking, so each
     numeric autosave keystroke-batch flashed the full-screen "저장하고 있어요"
     overlay (150ms show delay often exceeded by sheet round-trips).
  2. Contact `main` dimmed to `opacity-50` on **any** `dayQuery.isFetching`,
     so every autosave-triggered invalidate visibly flickered the whole page.
- Autosave itself is sound and worth keeping: `useContactMetrics` already has
  800ms debounce, sequential single-flight queue with latest-wins,
  invalid-gating, and a dirty navigation guard (`contact-metrics` +
  `contact-new-slots`). Restoring a manual save button is unnecessary.
- Fix direction: targeted background autosave UI — silent only the two
  autosave mutations, keep everything else blocking, drop the page dimming.

## Changes

- `components/ui/LoadingProvider.tsx` — strict explicit opt-out: pending
  mutations with `meta.silent === true` are excluded from the blocking overlay
  (and its message). Absent/`false`/any other value still blocks. Initial
  query loading and mixed foreground+silent pending still block.
- `lib/query/contact-hooks.ts` — `useSaveMetrics({ silent })` and
  `usePatchMeeting({ silent })` optional opt-in (default unchanged = blocking).
- `app/(app)/contact/page.tsx` — contact numeric + meeting autosave opt in
  with `{ silent: true }`; removed the `isFetching`-driven whole-main
  `opacity-50` dim. Initial load still early-returns under the global overlay;
  inline `AutosaveStatus` (pending/error/retry) is the save indicator.
- Explicit paths untouched and still blocking: create/register/delete/move
  mutations, schedule page hooks (default), initial loading overlay.
  Note: contact move reuses the page's silent `patchMeeting` for channel-change
  sub-steps, but the move still blocks via its own `moveMetrics`/`appendMeeting`
  mutations (mixed pending → overlay).

## Data-safety notes

- No API/data/schema changes; queue concurrency, 800ms batching, dirty guards,
  and failure surfacing unchanged. Failures still show "저장 실패 + 다시 시도"
  inline and never report "저장됨" before server ACK (regression-tested).
- No unresolved data-safety risk found: silent mutations only skip the overlay,
  they share the same queue/flush/retry/dirty-guard path.

## Test results

- New `tests/components/contact-loading-silent.test.ts` (6 tests) — silent
  pending allows click with no overlay; mixed foreground still overlays;
  default/`silent:false` still overlay; initial query loading still overlays;
  `useSaveMetrics`/`usePatchMeeting` default vs `{ silent: true }` meta.
- New `tests/components/contact-numeric-batch.test.ts` (5 tests) — rapid edits
  batch to one POST with newest values; slow-save + mid-flight edit sends both
  with newest last; failure surfaces error without false saved; page has no
  background-refetch dimming while the initial-load path stays.
- Runs: 11/11 new pass; existing 39/39 pass (contact-autosave-a,
  autosave-hook-behavior, autosave-late-ack, autosave-create-e3, input-flow).
- `tsc --noEmit`: no errors in changed files (repo has pre-existing errors in
  untouched `auth`/`ops`/`middleware` areas).
