---
slug: header-weekend
status: active
created: 2026-05-09
worktree: ../wt/header-weekend
---

# fix: 헤더 대시보드 → /dashboard + schedule WeekHeader 주말 빨간 테두리

## 1. 헤더 대시보드 버튼 destination
`components/TopHeader.tsx`: `href="/" → "/dashboard"`.
"/" 는 인트로 페이지 (app/page.tsx) — 의도와 다름.

## 2. schedule WeekHeader 주말 테두리
`app/(app)/schedule/_components/WeekHeader.tsx`: 주말(토/일) 버튼에 `border border-red-300` 추가 (오늘 강조 X 시).
DaySection은 이미 `border-l-[5px] border-red-300` 적용 중 — WeekHeader만 누락된 상태.
