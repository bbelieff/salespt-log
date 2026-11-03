---
slug: admin-users-collapsed-default
status: completed
created: 2026-11-03
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/admin-users-collapsed-default)
---

# 수강생관리 — 기수·팀·시즌 박스 기본 접힘 + PC 넓은 화면 격자

## Intent (왜)
관리자모드 › 수강생관리에 들어가면 기수·팀·아레나 시즌 박스가 전부 펼쳐져 있어 화면이 길다. belie 2026-11-03: 「다 닫혀있는걸 디폴트로」.

## Acceptance Criteria (수용 기준)
- [x] 처음 들어오면(저장된 펼침 상태 없음) 수강생관리의 기수·팀·아레나 시즌·보관 기수 박스가 모두 닫힘
- [x] 사용자가 펼쳐 둔 박스는 다시 들어와도 펼침 유지(기존 기억 기능 유지)
- [x] 예전 펼침 기억은 한 번 비움(저장 키 `salespt:admin:collapsed` → `:v2`)
- [x] 트레이너 화면(TrainerCohortView)은 지금처럼 펼침
- [x] PC(1024px+ — 노트북 전체화면 포함, belie 「노트북에서도 풀사이즈면 나와야지」): 화면 폭 전체 사용, 접힌 기수·시즌은 2열(1280px+ 3열) 칸, 펼친 기수는 한 줄 전체·안의 수강생 줄 2열(1280px+ 3열). 1024px 미만은 그대로
- [x] 검색 중엔 기수·팀·시즌 박스를 펼쳐 결과를 바로 보여 줌(펼침 기억은 안 바꿈)
- [x] 격자에서도 드래그 정렬(SortableList rectSortingStrategy)
- [x] `bash scripts/check.sh` 통과 · production build
- [x] 모바일/PC 실제 화면 확인(합성 데이터 1024·1280·375px)

## Context (참고)
- docs/design/components.md — PersistentDetails · AdminUserPickerSections · ArenaSeasonGroups
- PC 배치 설계안 B(기수 격자) — 설계 페이지 https://claude.ai/artifact/JumopLqsgvBAKwhaCStAw1, 적용 폭은 belie 지시로 1024px(pc)부터.

## Steps
1. CohortSection `collapsed?` prop → 기수·팀 PersistentDetails `defaultOpen={!collapsed}`
2. 수강생관리 호출부(CohortCategoryBoxes·ArenaSeasonGroups·보관 기수)에서 collapsed, 시즌 박스 defaultOpen=false
3. PersistentDetails 저장 키 v2
4. 시험 tests/components/admin-cohort-collapsed.test.ts
5. COHORT_GRID·ROW_GRID(`wide`)·`forceOpen`(검색), 컨테이너 `pc:max-w-none`, SortableList 격자 전략

## Log
- 2026-11-03 구현·시험 3개 추가.
- 2026-11-03 PC 격자(B안, 1024px+)·검색 펼침 추가, 시험 4개.
