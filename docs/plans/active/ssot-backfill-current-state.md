---
slug: ssot-backfill-current-state
status: active
created: 2026-05-08
worktree: ../wt/ssot-backfill
---

# SSOT Backfill — page-local 컴포넌트 + TS 식별자 일괄 등재

## Intent

`chore/doc-drift-guardrail` 도입으로 새 누락은 차단되지만, 기존 누락 33개 컴포넌트 +
10개 TS 식별자가 grandfathered로 면제되어 있었음.
이번 PR로 **모두 SSOT에 정식 등재** → grandfathered 라인 0 도달.

## Acceptance Criteria

- [x] **components.md §10 신설** — Page-Local Components (탭별 전용)
  - 10-1 공통 5개 (TabBar/MetricStepper/ChannelBadge/DateInputCustom/TimeSelectPair)
  - 10-2 contact 4개
  - 10-3 schedule 9개
  - 10-4 calendar 1개 (MonthGrid)
  - 10-5 db 7개
  - 10-6 payment 3개
  - 합계 29개 (TopHeader/DDayBadge/PageBanner는 §8에 이미 등재 = 32+3=35... 실제 grandfathered 33개)
- [x] **data-model.md §TypeScript 식별자 인덱스** 신설
  - 코어 6개 (Channel/MetricKey/MeetingState/Meeting/ChannelDailyRow/User)
  - 계약수납 v2 3개 (Progress/PaymentSlot/ContractPayment)
  - DB관리 4개 (DBPurchase/DBProduction/DBBanner/DBLead)
  - 대시보드 view 5개 (DashboardKPI/Matrix/Weekly/Cost/View — 코드 미존재여도 미리 등재)
- [x] **`docs/.ssot-grandfathered.md` 비움** — "현재 면제 항목: 없음" + Changelog
- [x] doc-drift PASS (12 types ✔, 5 SHEET_RANGES ✔, 33 components ✔)
- [x] check.sh 전체 PASS

## 결과

`bash scripts/doc-drift.sh` 출력에 **모든 항목 ✔ (grandfathered ⊘ 0)** — Hashimoto 부채 청산 완료.
이후 새 PR이 컴포넌트·타입 추가 시 SSOT 등록 강제 (가드레일 동작).

## Out of Scope (별도 PR)

- `Dashboard*` 타입은 코드(`lib/types/index.ts`)에 아직 없음. 이번 PR은 **선등재** (앞서갈) — 코드 도입 시 PR이 SSOT 누락 안 되도록.
- DB 섹션별 `formulaCols` 가드 리스트 / 마스터 레지스트리 본문 보강 등 sheet-structure.md 잔여 좌표 보강은 시트 디스커버리 후속에서 함께 처리.
