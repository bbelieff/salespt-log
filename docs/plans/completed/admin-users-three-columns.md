---
slug: admin-users-three-columns
status: completed
created: 2026-11-03
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/admin-users-three-columns)
---

# 수강생관리 PC — 3기수 나란히(3열 고정)

## Intent (왜)
belie 2026-11-03: 「기수는 한번에 3기수씩 돌아가니까 3기수를 병렬로 보자 펼쳐도 병렬이 깨지지 않는거지. 그리고 지나간 기수는 수동으로」.
#1301 의 격자는 펼친 기수가 한 줄 전체를 차지해 나란히 보기가 깨졌다.

## Acceptance Criteria (수용 기준)
- [x] PC(1024px+) 기수 박스 3열 고정 — 펼쳐도 자기 칸에서 아래로만 길어짐(한 줄 전체 차지 없음)
- [x] 펼친 기수 안 수강생 줄은 한 열(칸이 좁아 여러 열 제거)
- [x] 지나간 기수 자동 숨김 없음 — 기수 관리 보관 토글(수동) 그대로
- [x] 아레나: 시즌 3열(펼친 시즌은 한 줄 전체 — 그 안 기수가 3열)
- [x] 1024px 미만 그대로
- [x] `bash scripts/check.sh` · production build · 합성 화면 1280·1024px

## Context (참고)
- docs/design/components.md — AdminUserPickerSections(COHORT_GRID)·ArenaSeasonGroups
- 선행: #1301(격자)·#1303(왼쪽 메뉴)

## Log
- 2026-11-03 COHORT_GRID 3열 고정, `pc:open:col-span-full`·`wide`(ROW_GRID) 제거.
