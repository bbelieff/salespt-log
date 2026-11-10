# 2026-11-11 02:30 fix/dashboard-finance-column-detail

- 목표: 대시보드 매출·비용·영업이익 균등 세 칸·칸 아래 상세 — 계획 docs/plans/completed/dashboard-finance-column-detail.md
- 담당 파일: components/dashboard/{DashboardFinance,FinanceSummaryBoxes}.tsx · tests/components/dashboard-finance-column-detail.test.ts
- 검증: tests/components 191파일 통과, check.sh(커밋 훅)·CI build
- 위험/복구: 화면 배치만(계산·데이터 변경 없음). 문제 시 PR revert
