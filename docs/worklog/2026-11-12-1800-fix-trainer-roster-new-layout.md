## 2026-11-12 18:00 · fix/trainer-roster-new-layout — 트레이너 수강생 명단을 수강생관리와 같은 배치로

- 브랜치 fix/trainer-roster-new-layout. 요청: belie 「트레이너로 들어가면 수강생관리 구버전이 나와. 해결해줘」.
- 원인: `/admin/users` 만 카테고리 상자·접힌 기수 칩·PC 3열로 바뀌고, `/trainer`(TrainerCohortView)는 `CohortSection` 을 직접 세로로 늘어놓는 예전 배치로 남음.
- 결정: 사본을 만들지 않고 관리자 화면의 `CohortCategoryBoxes`(→ `ArenaSeasonGroups`·`CohortSection`)를 그대로 쓴다. 필요한 건 `trainerEmailLc` 전달 prop 하나뿐.
- 변경: `components/auth/{TrainerCohortView,CohortCategoryBoxes,ArenaSeasonGroups}.tsx`, 시험 `tests/components/trainer-roster-shared-layout.test.ts`(신설)·`admin-cohort-collapsed.test.ts`(설명 문구), `docs/design/components.md`. 서버(페이지 데이터·API 라우트)는 손대지 않음.
- 권한: 트레이너 화면은 늘 `viewOnly` + `onReorder`·`onAssignTrainers` 미전달 → 끌어 정렬·팀 변경·담당 변경 없음. 등록·승인·유보·일괄 도구는 AdminUserPicker 에만 있음. [주간목표]·[웹앱] 노출 규칙(담당·「활성 수강생 조회」)과 서버 재확인은 그대로.
- 달라지는 점: 기수 칩이 처음엔 접혀 있다(관리자 화면과 같음, 검색 중 자동 펼침). 폭 `wide`→`xwide`.
- 검증: `npx tsc --noEmit -p .`, vitest 관련 6파일. `bash scripts/check.sh`·production build·실제 화면(PC·모바일) 확인은 총괄 몫(NOT_RUN — 하위 작업 규칙).
- 미완료: 커밋·PR·배포 뒤 운영 화면 확인.
- [plan](../plans/completed/trainer-roster-new-layout.md)
