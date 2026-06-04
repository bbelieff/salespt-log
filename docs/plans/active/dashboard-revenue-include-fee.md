---
slug: dashboard-revenue-include-fee
status: active
created: 2026-06-05
owner: belie
related: 12-dashboard
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 총매출이 수임비만 합산해 수납액(수수료)을 누락 → 수납탭과 어긋나던 버그 수정. 총매출 = 수임비합 + 수수료합으로 통일.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/dashboard.ts`, `lib/types/index.ts`(DashboardKPI), `app/(app)/dashboard/page.tsx`
> - **관련 문서**: [[docs/plans/active/12-dashboard]]

# 대시보드 총매출 수수료 포함

## 원인
`dashboard.ts` revenue = `Σ p.수임비` (수임비만). 수납탭 SSOT는 총매출 = `Σ수임비 + Σ수납액(수수료)` → 대시보드가 수수료 누락해 어긋남.

## 변경
- **`computeContractRevenue(payments)`** 신규(export, 순수·테스트가능): `{ totalFee, totalReceived, revenue=totalFee+totalReceived }`. 수납탭 `totalContract + totalReceived` 와 **동일 정의**.
- `loadDashboard`: revenue 를 이 헬퍼로. profit/profitRate 자동 정합(revenue만 교체).
- `DashboardKPI` 에 `수임비합`·`수수료합` 추가 → 배너 분해를 67/33 가짜 대신 **실제 값**으로(`feeIncome=수임비합`, `commissionIncome=수수료합`, 합=총매출).
- 단위테스트 `tests/service/dashboard.test.ts`: revenue == 수임비합 + 수수료합, 수수료만 있어도 포함(회귀 방지).

## 2차 점검(별건)
- 즉시 반영 안 되면 대시보드 데이터 캐시 TTL — 본 PR 범위 밖(현재 dashboard 훅은 query 기반, 무효화 별도).

## Acceptance Criteria
- [ ] 대시보드 총매출 == 수납탭 총매출(수임비합 + 수수료합).
- [ ] 영업이익/이익률 새 매출 기준 정합. 배너 수임비+수수료 합 = 총매출.
- [ ] `npm run check` + 단위테스트 통과.

## 범위 밖
- 캐시 무효화, 비용 계산, 시트 좌표 변경.

## Log
- 2026-06-05 computeContractRevenue + revenue 교체 + KPI 분해 + 테스트.
