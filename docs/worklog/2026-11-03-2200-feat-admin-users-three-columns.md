## 2026-11-03 · 수강생관리 PC 3기수 나란히
- feat/admin-users-three-columns. belie 「3기수를 병렬로 보자 펼쳐도 병렬이 깨지지 않게, 지나간 기수는 수동으로」.
- 담당 파일: `components/auth/AdminUserPickerSections.tsx`·`ArenaSeasonGroups.tsx`·`CohortCategoryBoxes.tsx`·`AdminUserPicker.tsx`, `docs/design/components.md`, 시험 1개 추가(tests/components/admin-cohort-collapsed.test.ts), [plan](../plans/completed/admin-users-three-columns.md). 선행 #1301·#1303(병합됨).
- COHORT_GRID = PC 3열 고정, 펼친 기수 한 줄 전체(`pc:open:col-span-full`)와 수강생 줄 여러 열(`wide`) 제거. 지나간 기수는 기수 관리에서 수동 보관(자동 숨김 없음).
- 검증: 합성 화면 1280px(세 기수 펼쳐도 나란히), 1024px(왼쪽 메뉴와 함께 3열, 수강생 줄은 줄바꿈). 실제 운영 화면은 배포 뒤 확인.
- 되돌리기 = squash revert.
