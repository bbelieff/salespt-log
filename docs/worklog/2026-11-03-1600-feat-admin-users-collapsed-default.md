## 2026-11-03 · 수강생관리 박스 기본 접힘
- feat/admin-users-collapsed-default. belie 「수강생관리 들어가면 접힌카드가 다 열려있는데 다 닫혀있는걸 디폴트로」.
- 담당 파일: `components/auth/AdminUserPickerSections.tsx`·`AdminUserPicker.tsx`·`CohortCategoryBoxes.tsx`·`ArenaSeasonGroups.tsx`·`PersistentDetails.tsx`·`SortableList.tsx`, `docs/design/components.md`, 시험 1개, [plan](../plans/completed/admin-users-collapsed-default.md). 선행 없음.
- CohortSection `collapsed?`(기본 false) — 수강생관리에서만 true. 트레이너 화면은 그대로 펼침.
- 펼침 기억 저장 키 v2 로 바꿔 예전 기억을 한 번 비움(트레이너 관리의 권한부여·담당부여 접힘 기억도 같은 저장소라 한 번 기본값으로 돌아감).
- PC 넓은 화면(같은 PR, belie 「노트북에서도 풀사이즈면 나와야지」): 1024px+ 에서 폭 제한 해제, 접힌 기수·시즌 2열(1280px+ 3열), 펼친 기수 한 줄 전체·수강생 줄 2~3열. 검색 중 박스 펼침(`forceOpen`, 기억 불변). SortableList → rectSortingStrategy + CSS.Translate(트레이너 관리·아레나 관리 세로 목록도 같은 부품 — 세로에선 동작 동일).
- 검증: 합성 데이터 화면 1024·1280px(격자·펼침 한 줄 전체·검색 펼침/복귀), 375px 가로 밀림 없음. 실제 운영 화면은 배포 뒤 확인.
- 되돌리기 = squash revert.
