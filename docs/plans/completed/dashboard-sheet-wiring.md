---
status: completed
slug: dashboard-sheet-wiring
created: 2026-05-08
worktree: ../wt/wiring
completed: 2026-05-11
archived: 2026-07-12
---

# feat: 대시보드 시트 wiring (더미 → 실데이터)

## Intent

`feat/dashboard-page` PR 이후 대시보드는 prototype 더미만 표시. 실제 시트 wiring 필요.
시트 인스펙션(2026-05-08) 결과 대시보드(자동작성) 탭에 거의 모든 데이터 위치 확정.

## 시트 데이터 위치

| 영역 | 위치 | 내용 |
|---|---|---|
| I. 재무 | B21:G21 | 수임비, 수수료, 총매출, 총비용, 영업이익, 영업이익률 |
| II. funnel 합계 | B25:B30 | 6단계 (생산/유입/컨택/미팅예약/미팅완료/계약) |
| II. 5지표 | H25:H29 | DB퀄리티/컨택성공률/미팅실행률/미팅숙련도/영업생산성 |
| III. 8주차 | C33:H40 | 8주 × 6컬럼 (생산/유입/컨택/미팅/계약/활동량) |
| IV. 채널별 성과 | B45:E48 | 4채널 × (채널, 생산, 계약, 계약단가) |

## 변경 파일

- `lib/repo/dashboard.ts` 신설 — 1회 batchGet 5 ranges
- `lib/service/dashboard.ts` 재작성 — PROTOTYPE_DUMMY 폐기, 실제 시트 매핑

## 매핑 전략

### KPI (B21~G21)
- 수임비/총매출/총비용/영업이익/영업이익률 직접 매핑
- 영업이익률은 0~1 (소수) 또는 0~100 (정수) 자동 분기
- 누적수임비 = 수임비 (B21)

### Funnel (B25:B30)
- 6단계 합계 직접

### 채널별 stacking (Phase 1 한계)
- 시트에 직접 있는 건 채널별 **생산**과 **계약** 만
- 나머지 4단계 (유입/컨택/미팅예약/미팅완료)는 **채널별 계약 비율로 비례 분배**
- 정확치 X — 시각용. Phase 2에서 영업관리 매주 블록에서 채널별 정확 누적 필요

### 8주차 추이 (C33:H40)
- 활동량 직접 사용
- 영업이익은 시트에 주차별 없음 → 0 (Phase 2)

### 비용 분해 (3채널 도넛)
- 시트에 채널별 비용 직접 없음 → 0 (Phase 2 — 03 DB관리 탭 fetch 추가)

## Acceptance

- [x] lib/repo/dashboard.ts 신설 (1회 batchGet)
- [x] lib/service/dashboard.ts 재작성 (실데이터 매핑)
- [x] 시트 데이터 0 인 경우 graceful (DIV/0 → 0)
- [x] check.sh PASS
- [x] /api/dashboard 호출 시 실제 시트 데이터 반환 확인

## Phase 2 (별도 PR 후속)

1. **채널별 6단계 stacking 정확화** — 영업관리 매주 블록에서 채널별 8주 누적 합산
2. **주차별 영업이익** — 시트에 주차별 매출/비용 데이터 추가 또는 코드에서 계산
3. **채널별 비용 분해** — 03 DB관리 탭 fetch (매입DB 비용, 직접생산 비용, 현수막 비용)
4. **콜·지·기·소 수임비** — 04 업체관리에서 채널별 수임비 분해

## 검증

```
▶ typecheck  : PASS
▶ lint       : 0 errors
▶ structural : 6 passed
▶ unit       : 22 passed
▶ doc-drift  : PASS
▶ check.sh   : PASSED
```
