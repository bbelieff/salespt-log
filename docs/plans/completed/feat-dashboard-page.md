---
status: completed
slug: feat-dashboard-page
created: 2026-05-08
worktree: ../wt/dashboard-page
completed: 2026-05-11
archived: 2026-07-12
---

# feat: 대시보드 페이지 React 포팅 (prototype 기반 skeleton)

## Intent

claude.ai 핸드오프(2026-05-07)의 prototype HTML을 React 컴포넌트로 변환.
SSOT 갱신은 이전 PR들에서 완료. 이번 PR은 그 SSOT를 따르는 **UI 포팅 + 데이터 흐름 skeleton**.

## Acceptance Criteria

- [x] **타입** (`lib/types/index.ts`): DashboardKPI / Matrix / Weekly / Cost / View 5개
- [x] **service** (`lib/service/dashboard.ts`): `loadDashboard(email)` — 현재는 prototype 더미 반환, 시트 wiring TODO
- [x] **API** (`app/api/dashboard/route.ts`): GET → DashboardView
- [x] **hook** (`lib/query/dashboard-hooks.ts`): `useDashboard()` 5분 stale
- [x] **페이지** (`app/(app)/dashboard/page.tsx`): TopHeader + 4 sections
- [x] **컴포넌트** (`components/dashboard/`):
  - DashboardProgressBanner (sticky top-24 z-30 — 메인 배너)
  - FinanceSummaryBoxes (1:1 grid 박스)
  - OperatingProfitCard (border-l-4 + ＝ 배지)
  - FunnelChart (6단계 stacked SVG, 사다리꼴 15px, 채널 4색)
  - ProductivityIndicators (4지표, indigo gradient, 영업생산성 강조)
  - WeeklyDualChart (8주 활동량 line + 영업이익 bar, 음수 표시)
  - ChannelCostDonut (3채널 도넛 + 콜·지·기·소 별도 박스)
- [x] `npm run check` 전체 PASS (typecheck/lint/structural/tests/file-size/doc-drift)

## 데이터 흐름 (현재)

```
useDashboard() → /api/dashboard → service.loadDashboard(email)
                                  → [현재] PROTOTYPE_DUMMY 반환
                                  → [후속] readDashboard(spreadsheetId) + cell 매핑
```

prototype 더미값으로 UI 검증 가능. 실제 시트 wiring은 시트 디스커버리 후 별도 PR.

## 미해결 (시트 디스커버리 대기)

> `docs/handoff/inbox/dashboard-2026-05-07/DASHBOARD_DATA_DISCOVERY.md` 참조.

- **채널별 6단계 24 cells** (4채널 × 6단계) — 영업관리에 분해 영역 있는지, 또는 04 업체관리 GROUPBY로 동적 계산
- **8주차 활동량/영업이익 16 cells** — 영업관리 8주 블록 어디에 있는지
- **채널별 비용 3 cells** (매입DB/직접생산/현수막) — 어느 셀
- **콜·지·기·소 수임비 별도 셀** — 채널별 수임비 분해 가능한지
- **누적수임비 KPI 셀**
- **총비용 E21** 수식 확인 (D21=N6 처럼)
- **수임비/수수료 분해** — 매출 = 수임비 + 수수료의 각 셀

위 답변이 와야 `service/dashboard.ts` 의 PROTOTYPE_DUMMY를 실제 fetch로 교체 가능.

## Out of Scope (별도 PR)

- 실제 시트 read 구현 (`lib/repo/dashboard.ts`) — 시트 디스커버리 후
- 추가 인터랙션 (드릴다운, 필터링 등) — MVP 이후
- DashboardChannelMatrix 6필드 wiring (현재는 type만 6필드, 실제 데이터는 dummy)

## 검증

```
▶ typecheck         : PASS
▶ lint              : 0 errors (3 warnings — 기존 코드, 본 PR 무관)
▶ structural tests  : 6 passed
▶ unit tests        : 22 passed
▶ doc-drift         : PASS (DashboardKPI/Matrix/Weekly/Cost/View 모두 ✔)
▶ check.sh          : PASSED
```
