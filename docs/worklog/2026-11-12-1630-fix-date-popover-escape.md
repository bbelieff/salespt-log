# 2026-11-12 16:30 fix/date-popover-portal

- 목표: PC 주간 보드 미팅 창 「새 날짜」 달력 안 뜸 — 계획 docs/plans/completed/date-popover-escape.md
- 담당 파일: components/ui/DateInputCustom.tsx · app/(app)/db-sheet/_components/InflowPeriod.tsx · tests/components/ui-touch-date.test.ts
- 검증: 관련 시험 67건, check.sh(커밋 훅)·CI build, 배포 후 화면 확인
- 위험/복구: 달력 그리는 위치만(값·저장 그대로). 문제 시 PR revert
