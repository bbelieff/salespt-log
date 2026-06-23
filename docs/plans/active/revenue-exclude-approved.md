---
slug: revenue-exclude-approved
status: active
created: 2026-06-23
owner: belie
related: 0026-revenue-fee-plus-received, arena-start-revenue-split
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 매출에 승인총액이 섞여 들어가는 버그를 잡는다 — 전광판 매출 랭킹(코드) + 시트 수수료총합(O5 수식) 둘 다 "수납만" 집계로 교정.
> - **누가 읽나요**: 개발자
> - **연결**: lib/service/scoreboard.ts, lib/repo/setup-formulas.ts·contract-formulas.ts, 01 영업관리!O5
> - **관련**: [[docs/decisions/0026-revenue-fee-plus-received]], 인시던트 2026-06-12-carryover-revenue-leak

# fix — 매출 = 수임료 + 수납액 (승인총액 제외)

**개념**: 매출 = 수임료 + 실제 받은 수수료(=수납액). 승인금액은 "받기로 된" 기록용이며 매출 아님.
앱 JS 매출(splitContractRevenue)은 이미 정상 — 바꾸지 않음(SSOT).

## [A] 전광판 개인 매출 랭킹 (최우선, 단독 정상화)
- `scoreboard.ts loadIndividualRankings`: `매출 = dash.finance[2]`(대시보드 총매출 셀, 승인 포함 가능) 제거.
- 각 paid 시트의 02 계약수납을 `readContractPayments` + `splitContractRevenue(payments, O1기준).arena.revenue` 로 계산.
  → 대시보드 KPI 와 **완전 동일 정의** → 두 화면 매출 절대 안 어긋남.
- 캐시: cachedContractPayments + cachedCourseStart (30분, SCOREBOARD_TAG). cachedDashboard·readDashboard 의존 제거.

## [B] 시트 수수료총합 수식 (재발 방지, admin-gated install)
- `영업관리 O5 = '02 계약수납관리'!D3`(이월제외 수납총액) 만 — 승인총액 D2 절대 미포함.
- `contract-formulas.ts SALES_FEE_TOTAL_FORMULA` 상수 + `setup-formulas` 가 §2.5 pre-read 가드로 멱등 설치(raw 값이면 보존).
- ⚠️ **대시보드 탭(B21:G21/D21)은 구조테스트가 쓰기 금지** → 코드로 못 고침. 단 앱 KPI 는 JS(splitContractRevenue)로 이미 정상이라 화면 매출은 맞음. N6/대시보드 셀이 D2 를 직접 참조한다면 O5(=D3)로 cascade 되거나, 정확한 현재 수식을 belie 가 줘야 추가 교정 가능(후속).

## 검증
- 단위테스트: 승인>0·수납=0 → 매출=수임비(승인 미반영) / 수납 반영 / 이월 제외 / O5·D3·D4 어디에도 D2 없음.
- typecheck/lint/test/structural/doc-drift 그린.

## Log
- 2026-06-23 구현(fix/revenue-exclude-approved): scoreboard server-sum + O5 수식 + ADR-0026.
