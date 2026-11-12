---
slug: trainer-roster-new-layout
status: completed
created: 2026-11-12
worktree: _wt/salespt-log/trainer-roster (branch fix/trainer-roster-new-layout)
---

# 트레이너 수강생 명단 — 수강생관리와 같은 새 배치

## Intent (왜)
belie 2026-11-12: 「트레이너로 들어가면 수강생관리 구버전이 나와. 해결해줘」.
`/admin/users` 는 카테고리 상자·접힌 기수 칩·PC 3열(#1301·admin-users-collapsed-default·admin-users-three-columns)로 바뀌었는데,
`/trainer`(TrainerCohortView)는 `CohortSection` 만 직접 늘어놓아 기수마다 전폭 상자가 세로로 쌓이는 예전 배치로 남아 있었다.

## Acceptance Criteria (수용 기준)
- [x] `/trainer` 활성 기수 = `CohortCategoryBoxes`(수강생/아레나/테스트 상자 > 접힌 기수 칩 PC 3열 > 아레나 시즌 묶음) — 관리자 화면과 같은 컴포넌트, 사본 없음
- [x] 보관한 기수 = 접힌 상자 안 `COHORT_GRID` + 접힌 기수 칩
- [x] 「내 수강생만 보기」 토글·검색·안내 문구·제목 그대로
- [x] [주간목표]·[웹앱] 은 지금처럼 본인 담당(또는 「활성 수강생 조회」 권한) 카드에만
- [x] 관리자 조작(끌어 정렬·팀 변경·담당 변경·등록·승인·유보·일괄 도구) 미노출 — 회귀 시험으로 고정
- [x] 서버(페이지 데이터·API 라우트) 변경 없음
- [x] 1024px 미만은 한 열(COHORT_GRID 의 `space-y-8`) 그대로
- [x] tsc · 관련 vitest
- [ ] `bash scripts/check.sh` · production build · 실제 화면(PC·모바일) 확인 — 총괄

## 변경
- `components/auth/CohortCategoryBoxes.tsx`·`ArenaSeasonGroups.tsx`: `trainerEmailLc?` prop 추가(그대로 CohortSection 에 전달). 그 외 무변경 — 관리자 화면은 이 값을 주지 않아 동작 같음.
- `components/auth/TrainerCohortView.tsx`: 직접 그리던 기수 목록·「아레나 시즌N」 상자 → `CohortCategoryBoxes`. 보관 상자는 `COHORT_GRID`·`collapsed`. 폭 `wide`→`xwide`.
- 시험: `tests/components/trainer-roster-shared-layout.test.ts` 신설(6건), `admin-cohort-collapsed.test.ts` 설명 문구만 현재 사실로.
- 문서: `docs/design/components.md`(CohortCategoryBoxes·TrainerCohortView·수리3 절).

## 권한이 어떻게 지켜지나
- 화면: TrainerCohortView 는 `viewOnly` 를 값 없이(늘 true) 넘기고 `onReorder`·`onAssignTrainers` 를 넘기지 않는다 → TraineeCard 의 팀 입력(`!viewOnly`)·담당 변경(`canAssign`)·끌기 손잡이(SortableList `disabled`)가 꺼진다. 등록·승인·유보·일괄 도구는 AdminUserPicker 에만 있어 애초에 그려지지 않는다.
- 서버: 변경 없음. `/api/admin/*` 조작 라우트는 관리자 확인, `/api/admin/switch` 는 `canImpersonate` 가 매번 담당·권한을 다시 확인한다.

## 알려 둘 점
- 기수 칩은 관리자 화면처럼 **처음엔 접혀 있다**(펼친 기억은 브라우저에 남음, 검색 중엔 자동 펼침). 예전엔 트레이너 화면만 처음부터 펼침이었다.
