# 2026-11-11 01:45 fix/todo-quickadd-time

- 목표: 할 일 바로 추가 시각 고르기 + 실무/수납 상세 열 스크롤 여백 — 계획 docs/plans/completed/todo-quickadd-time.md
- 담당 파일: app/(app)/payment/_components/TodoSection.tsx · app/globals.css · tests/components/todo-quickadd-c.test.ts
- 검증: 관련 시험 48건 통과, check.sh(커밋 훅)·CI build
- 위험/복구: 화면만(저장 값 형식 HH:MM 그대로). 문제 시 PR revert
