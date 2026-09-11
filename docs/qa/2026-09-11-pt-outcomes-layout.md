# PT outcomes and compact business-tab goals

## Scope
- Review week N opens trainer-only outcome for task from week N-1 directly below that task.
- Uses existing private priorOutcome and CAS revision; no SQL, API, authorization, environment or real-student-data changes.
- First week has no previous-task outcome input. Private notes are not reinterpreted as public data.
- DB OverallCard, contact WeekHeader, schedule SummaryBar contain compact text goal values (null distinct from zero) and the entry-aware, dirty-guarded link. No separate business-tab ring cards; dashboard rings stay below productivity.

## Verification
- TypeScript pass; final full Next build pass (including PC size-token fix).
- Existing goal/service/API/repo/util tests: 177 passed; structural tests: 41 passed.
- Real React components in Windows Chrome + in-memory fixture API: 35 browser checks passed, no page errors. Includes outcome save/reload/week separation, private denial/races, draft preservation, return path, PC1440/mobile390 compact placement and >=44px goal entry target.
- Evidence in weekly-goals-evidence: compact-tabs-390/1440, pt-outcome-mobile/desktop. Synthetic data only. PC root font scales rem to13.5px; compact entry uses pc:min-h-14 to retain >=44px hit area.
- Production authenticated save and actual Notion table paste: NOT_RUN. Existing private service/repo tests cover persistence contract; browser fixture is not a production DB test.
- Final hook, CI, merge, deployment: pending. Baseline production/master: 61ee2f3717d6f752462b8fed523ec65dc82a5a45.
