---
slug: 09-payment-tab
status: active
created: 2026-04-30
worktree: ../wt/payment-tab
depends_on: 07-sales-meetings-repo
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수납 탭(`/payment`) — 일별 실적(승인/수납/금액/비고) 입력
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/`, `lib/repo/sales.ts` (`writeDailyRevenue` 이미 존재)
> - **읽고 나면 알 수 있는 것**: 시트 컬럼 매핑, 검증 규칙
> - **관련 문서**: [[docs/domains/sheet-structure.md]] §2 영업관리 Q~T

# 09 — 수납 탭 (일별 실적 입력)

## Executive Summary
일별 실적 데이터(승인건수/수납건수/수납금액/비고)를 영업관리 탭의 매주 블록 Q~T 컬럼에 기록한다. 1일 1 record. 백엔드는 이미 `writeDailyRevenue`로 구현되어 있어 read 함수 + service + API + UI만 추가.

## Acceptance Criteria

### 필수 기능
- [ ] `/payment` 페이지 — 날짜 네비 + 4 입력 필드
- [ ] 입력 필드:
  - 승인건수(Q): 0 이상 정수 (스테퍼 + 직접 입력)
  - 수납건수(R): 0 이상 정수 (≤ 승인건수)
  - 수납금액(S): 만원 단위 (수납건수=0이면 disabled)
  - 비고(T): 텍스트 (기관·접수내용)
- [ ] 검증: 수납건수 > 승인건수 시 경고
- [ ] 검증: 수납건수=0인데 금액>0 시 경고
- [ ] 저장 버튼 → `POST /api/payment/[date]` → 시트 Q~T update
- [ ] 페이지 첫 로드 시 GET으로 기존 값 표시 (있으면)

### 데이터 흐름
```
/payment
  └─ useDailyRevenue(date) → GET /api/payment/[date]
       └─ loadDailyRevenue(email, date)
            └─ readDailyRevenue(spreadsheetId, date) ← 새로 추가
       
  [💾 저장] 클릭
  └─ useSaveDailyRevenue.mutateAsync({date, revenue})
       └─ saveDailyRevenue(email, revenue)
            └─ writeDailyRevenue(spreadsheetId, revenue)  ← 이미 존재
       └─ onSuccess: invalidate ['payment', date]
```

### 시트 매핑
| 컬럼 | 필드 | 타입 |
|---|---|---|
| Q | approvalCount (승인건수) | int ≥ 0 |
| R | paymentCount (수납건수) | int ≥ 0, ≤ approvalCount |
| S | paymentAmount (수납금액, 만원) | int ≥ 0 |
| T | agencyNote (비고) | string |

행: `salesRowFor(date, "매입DB", courseStart)` — 그 날 첫 채널 행에만 기록.

## Technical Design

### 새 파일
- `app/(app)/payment/page.tsx` — 메인 페이지 (placeholder 교체)
- `app/api/payment/[date]/route.ts` — GET/POST
- 기존 hooks 파일에 `useDailyRevenue`, `useSaveDailyRevenue` 추가

### 기존 코드 활용
- ✅ `lib/repo/sales.ts` `writeDailyRevenue` (이미 있음)
- ⚠️ `readDailyRevenue` 추가 (그 날 한 행만 읽는 헬퍼)
- ⚠️ `lib/service/contact.ts` 또는 신규 `lib/service/payment.ts`에 service 함수
- 컴포넌트: 이전에 만든 `MetricStepper` 재사용 가능

## Log
- 2026-04-30 plan 작성 + 구현 시작
