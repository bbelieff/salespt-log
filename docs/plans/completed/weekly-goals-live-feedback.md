# Weekly goals production feedback — 2026-09-11

Scope: fix valid browser writes rejected behind VPS proxy; return to the originating student/trainer page; move dashboard goal rings below productivity.

Evidence: unauthenticated empty JSON PUT with production Origin returns403; identical request without Origin reaches domain validation400. No student data writes. Existing guard compares external Origin with internal Next URL. Return button uses real role rather than entry route.

Implementation: compare against already configured AUTH_URL origin (no environment changes, no forwarded-header trust); retain cross-site/content-type checks. Allowlisted returnTo paths carried from entry and guarded on exit. Preserve data/permissions/dirty guard. Move only goal summary on dashboard.

Verify: API regression for internal URL/external configured origin and forged origins; navigation browser regressions for trainer via student entry and trainer roster; desktop/mobile placement. Full check + build + normal hooks + CI, then merge/deploy/production no-write transport check. Actual authenticated save remains separate unless available.

Implementation complete. Focused API/navigation30 PASS, TypeScript PASS, Next build PASS, actual React browser32 PASS (including desktop1440/mobile390 entry-aware return and dashboard placement). Screenshots visually reviewed; header/closed expense dialog are fixture shells, layout/components under test are real. Existing auth/private/dirty/concurrency regressions retained.

Release gates: normal commit hook executes full scripts/check.sh; remote CI then deployment and no-write production origin check are tracked in the PR. No DB/environment/real-student changes.
