> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 비용도 매출처럼 개강일 기준 이월/시즌으로 나눠, 시즌 첫날부터 영업이익이 마이너스로 보이던 문제를 고친다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/dashboard.ts`(splitDbCost) · `lib/types/dashboard.ts` · `components/dashboard/OperatingProfitCard.tsx` · `app/(app)/dashboard/page.tsx`
> - **읽고 나면 알 수 있는 것**: ① 왜 비용은 이월이 안 됐었나 ② 무엇을 어떻게 나눴나 ③ 어디까지 확인했나
> - **관련 문서**: Linear BBE-83, BBE-42(카나리아 실측 경위), `docs/domains/data-model.md` DashboardKPI

## 1. 원인

매출(`splitContractRevenue`)은 `계약일 < 개강일` 이면 자동으로 "이월"로 분류하는 필터가 있었는데,
비용(`lib/repo/db.ts::readSection` — 03 DB관리 4섹션)은 그런 필터가 아예 없이 탭 전체를 그냥 더했다.
실측(손기학 A2-4기): 매입DB 비용 100%가 개강일(8/7) 이전 날짜인데도 "이번 시즌 비용"으로 표시돼
매출 0 − 비용 909,104 = 영업이익 -909,104(시즌 1일차·활동 0인데 마이너스).

## 2. 수정

`splitDbCost(rows, courseStartISO)` — `splitContractRevenue`/`isCarryoverContract`와 동일한
단일 결정점(`date < courseStartISO`)으로 매입DB(구매일)·직접생산(시작일)·현수막(날짜)을
시즌/이월로 분할. 영업이익은 시즌 비용만 사용(이월 제외), 이월비용은 매출과 동일하게
`OperatingProfitCard`에 3줄(시즌/이월/전체)로 정보성 표시.

**직접생산 날짜 기준(2026-08-07 수정)**: 최초 구현은 종료일‖시작일(종료일 우선)이었으나
어드버서리얼 리뷰(4-lens, 2개 lens 독립 합치)가 `ADR-0022 §3`("생산개수 집계=종료일&완료,
**비용(기간예산)은 시작 시 반영**")과 반대임을 지적 — `productionCountFor`(영업관리 E 집계,
`lib/service/db.ts`)의 종료일 기준을 비용에 그대로 재사용한 오류. 개강 전 시작·개강 후 완료인
경계교차 건이 시즌비용으로 오분류되는, 이 PR이 고치려는 것과 같은 종류의 버그였음 → **시작일
단일 기준**으로 정정, 경계교차 테스트 케이스 추가.

**범위 밖**: `expense-ledger`(추가비용)는 이미 `recognizedAmountForRange(...,courseStartISO,through)`로
courseStart 이후만 인식해 문제 없음 — 무변경. `콜·지·기·소`는 비용 0(콜지기소수임비 별도 처리)이라
`costBreakdown`에 원래 없음 — 무변경. `DashboardAdditionalCost.dbCostTotal`(진행바·비용원장 다이얼로그가
쓰는 "DB 비용" 합계)도 이번에 시즌분만으로 조용히 바뀌었으나 — `OperatingProfitCard` 3줄 표시는
의도적으로 이 카드로만 한정(리뷰가 지적, belie 재확인 불요 판단 — 타입 주석으로 스코프 명시 완료).

## 3. 게이트

- [x] `splitDbCost` 등 신규 pure 함수 단위테스트(8건) — 경계값(당일=시즌)·비ISO/빈값(안전 기본값=시즌)·
      courseStart 빈값·직접생산 경계교차(시작일<개강일≤종료일 → 이월)
- [x] 기존 `dashboard-sheet-latency.test.ts` 갱신(신규 KPI 필드 2개 추가, 값 불변 확인)
- [x] typecheck 통과
- [x] check.sh 전체 초록 (typecheck·lint·structural 25·unit/integration 1028·file-size cap·doc-drift 전부 통과;
      `lib/service/dashboard.ts` 553줄→500줄 캡 위반 발견 → `dashboard-cost-carryover.ts`·
      `dashboard-shadow-compare.ts` 2개로 분리해 해결, 로직 무변경)
- [x] 4-lens 어드버서리얼 리뷰 — BLOCKER/HIGH 1건(직접생산 날짜기준) 확인·수정, LOW 2건(SSOT 문서
      경로·dbCostTotal 스코프 주석) 문서 정정으로 반영, 나머지는 조치 불필요(의도된 스코프/회귀 아님)
- [ ] PR → 직렬 머지 → §6.8(배포·health)
- [ ] 라이브 재확인: 손기학 A2-4기 대시보드에서 이월비용 표시 + 영업이익이 더 이상 마이너스가 아님(또는 정확한 시즌 비용만 반영)
