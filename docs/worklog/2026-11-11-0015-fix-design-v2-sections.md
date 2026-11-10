# 2026-11-11 00:15 fix/design-v2-sections

- 목표: 화면 마감 v2 보정 — 구역 판 다시 나누기 — 계획 docs/plans/completed/design-v2-sections.md
- 담당 파일: app/surfaces.css · app/(app)/dashboard/page.tsx · components/dashboard/{DashboardActionOverview,DashboardWorkStatus,CollapsibleGoalCard,ProductivityIndicators}.tsx · components/dashboard/{followups-table,dashboard-action-overview}.css · app/(app)/db/{page,_components/DbChannelWorkspace}.tsx · app/(app)/schedule/_components/{WeekBody,DaySection}.tsx · docs/design/tokens.md · tests/components/dashboard-chart-carousel.test.ts
- 검증: tests/components·structural 통과, check.sh(커밋 훅)·CI build, 운영 합성 계정 화면에 CSS 주입 미리보기
- 위험/복구: class·CSS 만. 문제 시 PR revert
