> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 비용 원장 창의 "DB 비용·추가 비용·총비용" 요약을 대시보드 비용 칸과 같은 기간·같은 계산으로 맞춘다(화석 조사 B5).
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `components/dashboard/DashboardFinance.tsx` · `ExpenseLedgerDialog.tsx` · `app/(app)/dashboard/page.tsx`
> - **읽고 나면 알 수 있는 것**: 무엇이 달랐나 / 무엇을 같게 했나 / 되돌리는 법
> - **관련 문서**: ADR-0034, `lib/util/finance-period.ts`

---
slug: expense-ledger-cost-matches-dashboard
status: active
created: 2026-10-15
branch: fix/expense-ledger-cost-matches-dashboard
---

# 비용 원장 요약 = 대시보드 비용 칸

- **무엇이 달랐나**: 대시보드 비용 칸은 선택한 기간(기본 「전체」)으로 `periodDbCost`·`periodLedgerCost` 를 쓰는데(ADR-0034), 비용 원장 창 요약은 서버의 옛 시즌 값(`dbCostSeasonTotal` — 이월 제외, 수강시작일부터)을 받았다. 같은 화면에서 "DB 비용·총비용" 숫자가 서로 달랐다.
- **바꾼 것**: `DashboardFinance` 가 계산한 기간 합계(DB 비용·추가 비용·기간 이름)를 `onPeriodTotals` 로 알려 주고, 원장 창이 그 값을 그대로 쓴다. 기간을 바꾸거나 비용을 기록하면 함께 바뀐다. 아직 계산 전이면 예전 서버 값으로. 원장 창 머리에 "요약 기간: 전체" 처럼 표시.
- **그대로 둔 것**: 서버 응답의 옛 KPI 필드(D8 — ADR-0034 §6 유지), 채널 도넛의 시즌 비용(D 판단 대상).
- 검증: `tests/components/dashboard-finance-channels.test.ts` +1(전체 → 이번 주 전환 시 원장 요약 값), 원장 autosave 테스트, check.sh.
- 되돌리기: squash revert 1건. 데이터 변경 없음.