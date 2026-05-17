---
slug: revenue-unify
status: active
created: 2026-05-16
worktree: ../wt/revenue-unify
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 매출 출처를 02 계약수납관리 row 수임비 합산으로 통일 (시트 D21 수식 의존 제거) + revenue-mismatch 진단 룰 추가
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/dashboard.ts`, `lib/service/sheet-diagnostics.ts`
> - **읽고 나면 알 수 있는 것**: 왜 수납탭 매출 합과 대시보드 KPI 매출이 어긋났는가? PR #195 비용 통일 패턴 재사용

# revenue-unify — 매출 출처 단일 진실원천

## Executive Summary
2026-05-16 사용자 보고: **"수납과 대시보드의 매출합이 다름"**.

수납탭은 `readAll(contract-payment)` 의 row 단위 데이터(수임비, 수납액 등)를 직접 표시. 대시보드 KPI 매출은 시트 `대시보드!D21` 수식 결과를 읽음. 두 출처가 다른 row 셋을 참조하거나 수식이 잘못된 케이스에서 불일치.

**PR #195 (채널 비용 통일) 와 동일한 패턴**: 시트 자동 수식 의존 제거, 서버에서 동일 row 데이터를 sum 하여 단일 진실원천 확보.

## 변경

### 1. `lib/service/dashboard.ts` — fix
- `readAll(contract-payment)` 호출 추가 → row 의 `수임비` 합산
- `revenue = num(data.finance[2])` → `revenue = payments.reduce((s, p) => s + num(p.수임비), 0)`
- `fee` (누적수임비, B21) 는 유지 — 시트 B21 은 별도 KPI 카드 표시용
- profit/profitRate 는 새 revenue 기반 재계산 (기존 흐름 유지)

### 2. `lib/service/sheet-diagnostics.ts` — 5번째 룰 추가
- `revenue-mismatch` (severity: warn, fixable: false)
- detect: `대시보드!D21` vs `readContractPayments` 수임비 합. 차이 ≥1 → 경고
- fix: 없음 (시트 수식 자동 수정 위험 — admin 이 D21 수식 수동 조정)

## Hashimoto 누적 학습
- PR #195 (채널 비용) 와 PR #206 (매출) 은 같은 패턴: 시트 수식 의존 → 서버 sum
- 다음에 KPI 가 어긋난다는 보고 들어오면: "출처가 시트 수식인가? 서버 sum 으로 교체" 가 첫 가설
- revenue-mismatch 룰이 시트 D21 오염을 자동 감지 — 사용자가 시트 직접 봐도 안 헷갈리게

## Acceptance Criteria
- [ ] 수납탭 합계 = 대시보드 매출 KPI = 일치
- [ ] 김미란 등 D21 수식 의심 시트 [🔍 진단] → `revenue-mismatch` detect
- [ ] check.sh 통과

## Log
- 2026-05-16 매출 출처 통일 + 5번째 진단 룰 추가
