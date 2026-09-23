# Weekly goal save — 2026-09-23

No elapsed-week lock exists. Keys isolate enrollment and selected week; authorization, validation and revision compare-and-swap remain unchanged.

The public DirtyGuard entry incorrectly used the combined public/internal save while the internal editor registered its own save. Parallel save-and-navigate therefore attempted the internal save twice. A local real-component fixture reproduced `저장 중이에요.` and `1건 저장 실패` on week 3 with public goals and special notes dirty.

Muse split the public guard save from the combined save button. Each DirtyGuard entry now saves its own record once; the bottom button still saves both sections.

Verification via CUA and real React components with a local in-memory revision-checked API:
- Before: week 3, production 30 plus special notes; Save and move failed with the duplicate lock.
- After: same edits saved and navigated to future week 4.
- Week 4: production 40 plus special notes saved using the bottom button; returning to week 3 retained production 30 and its own notes.
- Past week 2: production 20 plus notes saved and navigated back to week 3 without error.
- Focused service/repository baseline 61 tests passed. Added 13 service/structural cases passed (past/current/future, key isolation, invalid weeks, enrollment conflict, revision conflict and private ACL).

No production student records were edited for this verification. The reported user's exact failed interaction is not yet confirmed; the duplicate-save path above is independently reproduced.

## Dashboard navigation clarification
The dashboard separately clamped selected dates to the current week and disabled Next at that anchor. Removed that ceiling; reset only on exact anchor equality and keep API upper week 5200/loading guards. Selected future date remains in the detail URL. Nine React DOM component tests passed: forward twice, back to anchor, minimum week, reset, future detail route, upper bound and loading/error guards.
