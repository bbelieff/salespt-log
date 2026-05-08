---
slug: ssot-dashboard-cells
status: active
created: 2026-05-09
worktree: ../wt/ssot-cells
---

# docs(ssot): 대시보드 wiring 셀 좌표 SSOT 정리

## Intent

`feat/dashboard-sheet-wiring` 머지 후 시트 좌표가 코드에 박혀있지만 SSOT 문서엔 일부 누락.
"시트 디스커버리 필요" / "TODO" 표기 정정 + 새로 박힌 R1:U6, N{38…}, F56/K56/U56 등재.

## 변경

### sheet-structure.md

**§1 대시보드(자동작성)**:
- 확정 셀 표 → 6 영역 명시 (I~V, 재무/퍼널/5지표/주차별/채널별/파이프라인)
- "웹이 직접 read하는 셀" 인덱스 추가 (탭별)

**§2 01 영업관리**:
- 상단 요약 셀 표: N1/N2/N6, **E1:E6 (funnel)**, **I2:I6 (5지표)**, K3:L6, **R1:U6 (stacking 24셀)**, **N{38,72,...,276} (주차별 계약수)**
- R1:U6 layout 명시 (행=단계, 열=R/S/T/U=4채널, channel offset 0~3)

**§5 03 DB관리**:
- 채널별 비용 셀 표 추가 (**F56 매입DB / K56 직접생산 / U56 현수막**)
- 콜·지·기·소 비용 X 명시

### data-model.md

**§대시보드 데이터 출처**:
- "확정 셀 매핑" 표 재작성 — 모든 셀 출처 명시 (대시보드/영업관리/DB관리)
- "미해결 디스커버리" 섹션 → "Phase 2 후속" (소형화)
- DashboardWeeklyPoint: `영업이익` → `계약수` (사용자 결정 반영)
- DashboardChannelMatrix 주석: "코드 식별자 정정 필요" → "R1:U6 read 완료"

## Acceptance

- [x] sheet-structure.md §1/§2/§5 갱신
- [x] data-model.md §대시보드 데이터 출처 갱신
- [x] check.sh PASS

## 효과

- 외부 에이전트가 SSOT만 보고 시트 좌표 100% 재현 가능
- "TODO 디스커버리" 부채 청산 — 모든 wiring 셀 정확히 등재
