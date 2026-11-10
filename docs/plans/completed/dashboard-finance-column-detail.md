# 대시보드 매출·비용·영업이익 — 균등 세 칸·칸 아래 상세

- 목표(2026-11-11 belie): [1] 기간 칩 왼쪽 「매출·비용·영업이익」 글자 삭제 [2] 세 칸 균등, 누른 칸 바로 아래·그 칸 너비 안에서만 상세 [3] 「직접 설정」 눌렀을 때 안내 문장 삭제.
- 변경: DashboardFinance(제목 글자·incomplete 전달 제거), FinanceSummaryBoxes(grid-cols-3 고정, 칸마다 감싸 상세를 그 칸 안에 렌더, 닫힘이면 숨은 패널 1개로 aria-controls 유지). PeriodPicker 는 공용이라 그대로(실무/수납·DB관리시트 안내 유지).
- 수용: tests/components/dashboard-finance-column-detail.test.ts, 기존 finance 시험 통과, check.sh·build.
