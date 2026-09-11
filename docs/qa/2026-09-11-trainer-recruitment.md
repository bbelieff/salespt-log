# Trainer recruitment — #956 verification

## Scope / implementation

OG sole writer: `feat/trainer-recruitment-unified`, base `c781feb`. DH independent review, production coordination and sole user reporter. Approved direct application → admin approval; admin-only recipient-bound invitation → explicit acceptance activates immediately. Pending cancellation and reapplication preserve all student rows/history.

- Qualification SSOT is separate from student enrollment. Revocation/cancellation tombstones suppress legacy membership; `findTrainerByEmail` authorizes capability while CRM selection retains the student registration. Applicant-chosen names cannot unlock legacy name-based arena records.
- First top header row contains logo, dashboard and 44px student/trainer segments. Mobile metadata uses second row. Downstream sticky bars account for 144px mobile / 104px desktop total header stack.
- Account-bound httpOnly role cookie remembers independent safe pages. Explicit apply/invite destinations win. Token/query/admin/impersonated-target paths cannot be remembered. Server rechecks capability; switching clears impersonation and stale client caches.
- Invitation fragment is removed on mount, held in tab sessionStorage through OAuth, and removed after acceptance. OAuth callback is fixed `/trainer/invite`. Server stores SHA-256 digest only. Analytics excludes invitation URLs and masks generated-link inputs. No invitation is auto-sent.

## Executed verification

- Recovered check.sh: PASS; structural 40 passed / 1 skipped; unit 1777 passed / 37 skipped (190 suites passed / 2 skipped). Skips belong to pre-existing optional operational suites. Trainer SQL 5 tests and exact migration 3 tests ran, not skipped. Final commit hook reruns the full check on staged bytes.
- Final Next build passed after the header sticky corrections (exit0, /tmp/trainer-build-final-resumed.log).
- PGlite executes the real 0006 SQL and repository operations: application/approval, same-recipient acceptance/retry, wrong-recipient/forged/revoked/expired rejection, cancel→reapply, stale cancel after approval, student row snapshot preservation, anon/authenticated read/write denial. This is a disposable DB, not production.
- Service tests exercise real-session authorization, production canonical Origin with internal listener, forged/missing Origin rejection, role memory isolation and capability revocation.
- Actual Next client components rendered in a separate browser root with real compiled CSS, mocked fetch/account state and pathname/router contexts. No production auth bypass. Mobile 360px: document scrollWidth 360, header96px, dashboard/student/trainer button y6px and height44px. 390px and desktop1440 screenshots captured.
- Actual application UI: apply → pending → confirmation → cancel → reapply observed; actual switch: explicit switch request and simulated503 error remain on page with visible alert. Role/page persistence and impersonation clearing verified in service tests; authenticated real-browser switch/OAuth remain NOT_RUN.
- Browser QA failures were harness-only: old Chrome wrapper failed ICU startup (default browser launcher worked); removing Next's original root produced HMR/client errors (replaced with separate fixture root). These attempts are not counted as passing browser evidence. No production credentials or data used.
- Evidence: workspace artifacts/trainer-release-956 (screenshots); /tmp/trainer-check-resumed.log, /tmp/trainer-migration-tests.log and final build/hook logs.

## Exact migration / rollout gate

`0006_trainer_recruitment.sql`, SHA256 `86912575f589f0b614ce6d798a966774fe771b6f0f7e92d817d7ff91f35cc8d4`.

1. Review fixed PR head and pass CI. Coordinate one release at a time.
2. On existing trusted deployment/DB execution path, verify pinned source and current runtime contract; execute `scripts/ops/trainer-recruitment-migrate.mjs --preflight` first (default read-only). Existing credential resolver only; do not copy connection values into commands/logs.
3. Exact runner refuses checksum drift, untracked target objects, unsafe pre-existing ledger, nonmatching columns/constraints/index counts, browser ACL access and missing server DML. No repair/adoption, no broad pending migration execution.
4. `--execute` applies only the two new tables and exact ledger entry under the shared migration advisory lock, checks catalog/security and is repeat-no-op. Apply before starting the new app. No student data edits.
5. Merge approved head, observe deploy and merge-SHA CI, public health and authenticated user journeys.
6. On regression revert the application commit and verify recovery; retain qualification tombstones and invite audit, do not drop security state.

## Outstanding evidence

Independent full PR review, production exact-migration preflight/apply, merge/deploy/health, authenticated apply/cancel/invite/role switching are NOT_RUN at this checkpoint. The existing DB Migrate workflow now accepts exact `0006_trainer_recruitment.sql` on the reviewed feature ref: `execute=false`, `compare_runtime=true`, full `expected_sha` and pinned `expected_sql_sha256`. After successful read-only results, repeat with execute=true. Immutable artifact/delivery+SQL tests:22/22 PASS (including tampered helpers, unapproved SQL, runnable isolated module graph, repeat-no-op, no ledger repair). Shared runtime/catalog readers are shipped hash-pinned; old weekly-goal runners are unchanged.

Existing DH completion loop `43e2abaeb78a` tracks these; no duplicate loop created. Do not close #956 on local checks alone.

References: [Supabase Data API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api), [Next.js page conventions](https://nextjs.org/docs/app/api-reference/file-conventions/page). Current repo tooling and approved exact-runner contract, not Supabase CLI migration naming, govern this repository's migration inventory.
