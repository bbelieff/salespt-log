---
slug: refactor-dashboard-funnel-6stage
status: active
created: 2026-05-08
worktree: ../wt/funnel-6stage
---

# refactor: contactSuccess → meetingReservation 일괄 rename

## Intent

시트 디스커버리(2026-05-08)로 영업관리 H열 헤더가 "컨택성공" → "미팅 예약건 수"로 변경됨.
SSOT (`docs/domains/data-model.md`, `docs/domains/sheet-structure.md`)는 갱신 완료.
이번 PR로 코드 정합 — TS 식별자 + UI 라벨 일괄 rename.

## Scope (Option X — rename only)

이번 PR은 **기계적 rename**만. 6필드 확장 (`DashboardChannelMatrix` 4→6)은 별도 PR로 분리.
이유: 미팅완료/계약 데이터 출처(04 업체관리 COUNTIFS) 시트 디스커버리 후가 안전.

## Acceptance Criteria

- [x] **TypeScript 식별자**: `contactSuccess` → `meetingReservation`
  - `lib/types/index.ts` (MetricKey enum, METRIC_LABEL, ChannelDailyRow Zod)
  - `lib/config/index.ts` (metricCols)
  - `lib/repo/sales.ts`
  - `lib/service/contact.ts`
  - `lib/service/gamification.ts`
  - `app/api/daily/[date]/route.ts`
  - `app/(app)/contact/page.tsx`
  - `app/(app)/contact/_components/ChannelTabsAndPanel.tsx`
  - `app/(app)/contact/_components/MeetingSlotItem.tsx`
  - `components/ui/MetricStepper.tsx`
- [x] **한글 라벨/주석/Toast**: "컨택성공" → "미팅예약" (의미 보존되는 곳)
  - 단, 역사 참조 ("구 컨택성공") 명시는 lib/types/index.ts + lib/config/index.ts 주석에 유지
- [x] METRIC_LABEL.meetingReservation = "미팅예약" (UI 짧은 라벨)
- [x] `npm run check` 전체 PASS (typecheck/lint/structural/tests/file-size/doc-drift)

## Out of Scope (별도 PR)

- `DashboardChannelMatrix` 4 → 6 필드 확장 (미팅완료/계약 추가)
  - 이유: 시트 디스커버리(24 cells 위치) 결과 필요
  - 별도 PR: `refactor/dashboard-matrix-6field` (시트 디스커버리 후)

## 검증

```
▶ typecheck          : PASS
▶ lint               : PASS
▶ structural tests   : 6 passed
▶ unit tests         : 22 passed
▶ doc-drift          : PASS
▶ check.sh           : PASSED
```
