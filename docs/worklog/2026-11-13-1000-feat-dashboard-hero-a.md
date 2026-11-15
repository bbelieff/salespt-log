## 2026-11-13 · 대시보드 맨 위 띠 A안 (feat/dashboard-hero-a)
- 브랜치 feat/dashboard-hero-a. 요청: belie 승인 A안 — PC 진행 줄+기간 칩 한 줄, 재무 네 칸(매출·비용·영업이익·진행건)+미리보기 두 줄, PC 아래 진행건 판 제거, 폰 그대로.
- 담당 파일: app/(app)/dashboard/page.tsx · components/dashboard/{DashboardFinance,FinanceSummaryBoxes,FinanceWorkColumn(새),DashboardWorkStatus,DashboardProgressBanner}.tsx · components/dashboard/dashboard-action-overview.css · components/payment/WorkStatusBar.tsx(STATUS 내보내기·popoverAlign 선택 prop, 기존 모양 그대로) · docs/design/components.md §9 · tests/components/{dashboard-hero-a(새),dashboard-finance-column-detail}.test.ts
- 검증: tsc 통과 · vitest 관련 15파일 141건 통과 · eslint 통과. 실제 화면 캡처 NOT_RUN(총괄 확인). check.sh·build 는 총괄이 실행.
- 위험/복구: 화면만(조회·계산 그대로). 문제 시 PR revert. [plan](../plans/completed/dashboard-hero-a.md)
