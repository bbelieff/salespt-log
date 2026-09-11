# Weekly goals polish verification — 2026-09-11

- Actual React components + app fonts/CSS; synthetic API/data and reserved 96px navigation shell. This is not an authenticated production or actual Notion paste test.
- Browser: 40 PASS, no page errors. PC 1366×768 goal bottom 681.55px; mobile 390×844 goal bottom 781px before 60px bottom navigation. Fixture includes nonzero revenue/cost and long PT text; expand/collapse preserves financial values with no horizontal overflow.
- Compact business summaries: actual / goal, achievement/overachievement, unset/zero distinct; STEP palette; no duplicated dashboard rings. Target entry >=44px; PC/mobile summary height limits pass.
- Clipboard: rich HTML one body row / 14 cells, no header cells; plain TSV one 14-column row. Existing private/public separation, escaping, week/save/permission/race/dirty guards pass. On-screen preview headings remain.
- Focused copy + region tests: 16 PASS, including 4 real disposable PGlite tests (read-only, exact enrollment, no overwrite, idempotence). PGlite lives outside app dependencies. CI without QA_TOOLS_DIR explicitly skips those four; CI alone is not their execution evidence.
- Regional data: baseline timetable only, exact cohort + name + email + spreadsheet identity. Existing user team field, no schema change; blank-only parameterized transactional updates. Inputs are local private files; public workflow receives opaque SHA-256 keys including spreadsheet ID, never names/emails. Dry-run and post-write recheck required. Cohort transitions require the new baseline source to be confirmed; no automatic Notion watcher is enabled.
- Final Next production build: PASS, all 71 pages generated. Normal commit hook/remote CI still required.
- Production region writes and app deployment were pending at commit time; record actual action results in release report.
- Screenshots: [PC first screen](weekly-goals-evidence/first-screen-1366.png), [mobile first screen](weekly-goals-evidence/first-screen-390.png), [compact tabs](weekly-goals-evidence/polish-compact-tabs-390.png).
