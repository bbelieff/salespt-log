---
slug: admin-users-collapsed-default
status: active
created: 2026-11-03
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/admin-users-collapsed-default)
---

# 수강생관리 — 기수·팀·시즌 박스 기본 접힘

## Intent (왜)
관리자모드 › 수강생관리에 들어가면 기수·팀·아레나 시즌 박스가 전부 펼쳐져 있어 화면이 길다. belie 2026-11-03: 「다 닫혀있는걸 디폴트로」.

## Acceptance Criteria (수용 기준)
- [x] 처음 들어오면(저장된 펼침 상태 없음) 수강생관리의 기수·팀·아레나 시즌·보관 기수 박스가 모두 닫힘
- [x] 사용자가 펼쳐 둔 박스는 다시 들어와도 펼침 유지(기존 기억 기능 유지)
- [x] 예전 펼침 기억은 한 번 비움(저장 키 `salespt:admin:collapsed` → `:v2`)
- [x] 트레이너 화면(TrainerCohortView)은 지금처럼 펼침
- [ ] `bash scripts/check.sh` 통과 · production build
- [ ] 모바일/PC 실제 화면 확인

## Context (참고)
- docs/design/components.md — PersistentDetails · AdminUserPickerSections · ArenaSeasonGroups
- PC 와이드 확장 배치는 별도 설계안(belie 선택 후 별도 PR) — 이 PR 범위 아님.

## Steps
1. CohortSection `collapsed?` prop → 기수·팀 PersistentDetails `defaultOpen={!collapsed}`
2. 수강생관리 호출부(CohortCategoryBoxes·ArenaSeasonGroups·보관 기수)에서 collapsed, 시즌 박스 defaultOpen=false
3. PersistentDetails 저장 키 v2
4. 시험 tests/components/admin-cohort-collapsed.test.ts

## Log
- 2026-11-03 구현·시험 3개 추가.
