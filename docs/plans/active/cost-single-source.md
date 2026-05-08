---
slug: cost-single-source
status: active
created: 2026-05-09
worktree: ../wt/cost-single-source
---

# fix(dashboard): 비용 단일 진실원천 — 메인 배너 ↔ 채널별 도넛 정합

## 문제

- 메인 배너 비용 = `대시보드(자동작성)!E21` (시트 자체 수식)
- 채널별 비용 도넛 = `03 DB관리!F56 + K56 + U56` 합 (3채널)
- 두 출처가 다르므로 시트 E21 수식이 콜·지·기·소(4채널) 또는 다른 row 참조하면 어긋남.

## 변경

`lib/service/dashboard.ts`:
- `cost` = `data.costByChannel.reduce(sum)` — 03 DB관리 3채널 합으로 직접 계산
- `profit` = `revenue − cost` — 동일 출처 기반 재계산
- `profitRate` = `(profit / revenue) × 100` — division-by-zero 가드
- 시트 E21/F21/G21 의존 제거 (data.finance[3..5] 무시)

## 효과

- 메인 배너 비용 ≡ 채널별 도넛 합 (항상 일치)
- 사용자 결정 "콜·지·기·소 비용 제외" 자동 강제 (시트 수식 무관)

## Acceptance

- [x] typecheck PASS
- [x] lint PASS
- [x] test:structural PASS
- [x] doc-drift PASS
