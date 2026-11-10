# 2026-11-10 23:00 feat/db-step1-list-right — PC 구매목록을 오른쪽 칸으로

- 목표: belie 「구매목록이 우측열로 위치할 수 있도록」(PC 캡처).
- 담당 파일: app/(app)/db/_components/DbChannelWorkspace.tsx, tests/components/db-mobile-order.test.ts, docs/design/components.md.
- 변경: 1440px 이상 왼쪽 = 추가 폼, 오른쪽 = 구매목록 → 합계. 좁은 화면 순서(추가 → 목록 → 합계) 그대로.
- 검증: 관련 시험, check.sh(커밋 훅). 실제 화면 NOT_RUN(로컬 운영 비밀값 없음) — 배포 뒤 확인.
- 위험/복구: 배치만 변경. 문제 시 revert.
