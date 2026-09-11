# Trainer recruitment — #956

Owner: OG sole implementation, DH sole user reporting/operational coordination, VH review.
Base c781feb, branch feat/trainer-recruitment-unified. Preserve DH Windows WIP read-only.

## Confirmed scope
- Direct application for student/nonstudent; administrator approval. Student entry below guide in logo menu, public login entry.
- Administrator creates recipient-bound invitation; explicit authenticated acceptance immediately activates.
- Pending cancellation (confirmation), reapplication; no student rows/keys/history changed.
- Single agreed v3 design: first top header row logo + dashboard + student/trainer segmented buttons; mobile metadata second row, 44px targets, no new sidebar.
- Role-specific safe last page and account-bound last role. Explicit invitation/application entry wins. Never remember tokens or impersonated targets.
- User 17:06:59 explicitly requested completion loop through production. Prepare exact migration, checks and PR then coordinate production rollout with DH; do not stop at another mockup.

## Progress
- [x] Login return destination allowlist and login handoff.
- [x] Separate qualification projection/authorization and student CRM selection.
- [x] Recipient-serialized transactional invitation/application/cancel operations, token hash only, RLS and no public grants.
- [x] Shared header, role memory, actual application/invitation/admin forms.
- [x] Focused auth/service/SQL checks, including cancellation race ordering and stale-token revocation.
- [x] Full check.sh and prior build; actual rendered PC/mobile component verification with mocked transport. Final release build passed; staged-byte commit hook pending.
- [x] PR #959 ef77fa4 CI and exact read-only runtime/preflight PASS.
- [ ] DH 3-item review corrections implemented; full revalidation and new fixed-head re-review.
- [ ] Exact additive DB migration and production rollout + authenticated smoke evidence.

## Risks to verify
Legacy name-based arena access must be restricted to original registry names, never applicant-selected names. Trainer qualification tombstones remove legacy capability. Neither approval/rejection nor removal may select a student enrollment row. Remembered destinations are navigation preferences, never authorization.

## Database rollout
Migration 0006_trainer_recruitment.sql adds two tables only. No lazy DDL and no users mutation. Existing DB Migrate dispatch now supports exact 0006 with immutable artifact and required runtime comparison; legacy history repair is explicitly forbidden for this mode. Apply before new app starts; verify RLS/grants and checksum. Do not run general migrations blindly when other pending migrations exist. Rollback app if needed, retain qualification tombstones and invite audit rows; do not drop security state.
