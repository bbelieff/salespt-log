---
status: completed
slug: productivity-indicators-unified
created: 2026-05-08
worktree: ../wt/productivity-unified
completed: 2026-05-11
archived: 2026-07-12
---

# fix: 생산성 지표 4개 통일 — 사용자 결정 + 미팅완료 재정의

## Intent

3 소스 (대시보드 H25:H29 / 영업관리 H3:H6 / 웹 React) 정의가 다 달라 헷갈림.
사용자 결정으로 4지표 통일 + 미팅완료 정의 변경.

## 사용자 결정 (2026-05-08)

| 지표 | 공식 | 의미 |
|---|---|---|
| DB 퀄리티 | 컨택진행 ÷ 유입 | DB가 부재/거절 없이 컨택된 비율 |
| 컨택성공률 (구 컨택숙련도) | 미팅예약 ÷ 컨택진행 | 컨택 → 미팅예약 |
| 미팅숙련도 | 계약 ÷ 미팅완료 | 미팅완료(계약+완료+취소) 중 계약 비율 |
| 영업생산성 | 계약 ÷ 컨택진행 | 종합 |

**미팅완료 정의 변경**: 기존 "완료+계약" → 신 "**계약+완료+취소**" (변경만 제외).

## 변경 파일

- `components/dashboard/ProductivityIndicators.tsx` — 라벨 컨택숙련도→컨택성공률, 주석 정정
- `lib/types/index.ts` — DashboardChannelMatrix.미팅완료 주석 (계약+완료+취소)
- `lib/service/dashboard.ts` — dummy 미팅완료 값 조정
- `docs/domains/data-model.md` — §6단계 funnel 미팅완료 재정의 + §생산성 지표 4개 통일
- `docs/design/components.md §9-5` — ProductivityIndicators 명세 + 변경 이력
- `docs/handoff/sheet-update/productivity-2026-05-08.md` — 시트 정정 가이드 (수동 작업)

## 시트 정정 (별도 — 사용자 수동)

상세: `docs/handoff/sheet-update/productivity-2026-05-08.md`
- 영업관리 F5 수식: 취소 포함하도록 변경
- 대시보드 B25:B30: 6단계 funnel 확장 (미팅예약 추가)
- 대시보드 H25:H29: 4지표 라벨/수식 재구성

웹은 자체 계산하므로 시트 손대지 않아도 동작. 시트는 사용자 가시성 통일용.

## 검증

```
▶ typecheck  : PASS
▶ lint       : 0 errors
▶ structural : 6 passed
▶ unit       : 22 passed
▶ doc-drift  : PASS
▶ check.sh   : PASSED
```
