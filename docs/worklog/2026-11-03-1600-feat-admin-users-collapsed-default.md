## 2026-11-03 · 수강생관리 박스 기본 접힘
- feat/admin-users-collapsed-default. belie 「수강생관리 들어가면 접힌카드가 다 열려있는데 다 닫혀있는걸 디폴트로」.
- 담당 파일: `components/auth/AdminUserPickerSections.tsx`·`AdminUserPicker.tsx`·`CohortCategoryBoxes.tsx`·`ArenaSeasonGroups.tsx`·`PersistentDetails.tsx`, `docs/design/components.md`, 시험 1개, [plan](../plans/active/admin-users-collapsed-default.md). 선행 없음.
- CohortSection `collapsed?`(기본 false) — 수강생관리에서만 true. 트레이너 화면은 그대로 펼침.
- 펼침 기억 저장 키 v2 로 바꿔 예전 기억을 한 번 비움(트레이너 관리의 권한부여·담당부여 접힘 기억도 같은 저장소라 한 번 기본값으로 돌아감).
- 되돌리기 = squash revert.
