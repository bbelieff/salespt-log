---
slug: ssot-update-dashboard-2026-05-07
status: active
created: 2026-05-08
worktree: ../wt/ssot-dashboard
---

# SSOT 갱신 — 대시보드 핸드오프 + 시트 디스커버리 반영

## Intent

claude.ai 프로젝트의 dashboard prototype 핸드오프(2026-05-07)와 시트 디스커버리(2026-05-08)
결과를 4개 SSOT 문서에 반영.

직접 트리거:
- 시트 디스커버리 결과 (Q4 답변)로 영업관리 H열, N2 수식, D21 출처 확정
- prototype 핸드오프로 6단계 funnel·생산성 지표·대시보드 컴포넌트 7개 도착
- Q2/Q3 사용자 결정 받음 (brand-red 토큰화, 대시보드 자체 헤더 = 5탭 동일 구조)

원칙: "현재 코드/시트가 진실, SSOT가 따라간다." 옛 plan 끌어오지 않음.

## Acceptance Criteria

- [x] data-model.md 갱신
  - H열 헤더 "미팅 예약건 수" (구 "컨택성공") + 코드 식별자 매핑 명시
  - N1/N2 시트 디스커버리 확정 (N2=`=N1+57`, 종강총회와 같은 날)
  - 6단계 영업퍼널 정의 (생산→유입→컨택진행→미팅예약→미팅완료→계약)
  - 생산성 지표 4개 공식 (DB퀄리티/컨택숙련도/미팅숙련도/영업생산성)
  - 대시보드 데이터 출처 + view 코드 매핑 (DashboardKPI/ChannelMatrix 등)
  - ChannelRow.컨택성공 → 미팅예약 (시트 헤더와 일치)
- [x] sheet-structure.md 갱신
  - 각 SHEET_RANGES JS 키(`dashboard`/`sales`/`meetings`/`contractPayment`/`dbManagement`) 명시
  - sales: blockStart=10/blockStride=34/N6 매핑
  - meetings: R(previousMeetingId)/S(주차) 컬럼 등재
  - contractPayment: headerRows=5/firstDataRow=6 (코드 정합성)
  - dbManagement: headerRow=3/maxRow=100/formulaCols
  - §6 마스터 레지스트리 신설
  - 대시보드 D21 = 영업관리!N6 매핑
  - 검증 규칙 "컨택성공" → "미팅예약"
- [x] components.md
  - §8 대시보드 페이지 변형 사양 (Q3 A — 5탭과 동일 구조 + ④ 자리만 변형)
  - §9 Dashboard 신설 — 7개 컴포넌트 (DashboardProgressBanner / FinanceSummaryBoxes / OperatingProfitCard / FunnelChart / ProductivityIndicators / WeeklyDualChart / ChannelCostDonut)
- [x] tokens.md + tailwind.config.ts
  - brand-red 토큰화 (`bg-brand-red`/`text-brand-red`/`border-brand-red`)
  - Z-Index 표에 대시보드 메인 배너 z-30/top-24 추가
- [x] grandfathered 정리 — TopHeader/DDayBadge 제거 (header-ssot 머지로 §8 등재 완료)
- [x] doc-drift PASS, check.sh 전체 PASS

## Follow-up (별도 PR)

- `refactor/brand-red-token` — 코드 내 `[#d71617]` 발생 위치를 `bg/text/border-brand-red` 로 일괄 치환
- `refactor/dashboard-funnel-6stage` — `lib/types/index.ts` `MetricKey` 및 `DashboardChannelMatrix` 5필드 → 6필드 (미팅예약·미팅완료·계약 분리)
- `fix/dday-graduation-anchor` — `lib/service/me.ts` 49→57, weekTargetISO→graduationISO
- `docs/ssot-backfill-current-state` — page-local 컴포넌트 일괄 등재 (현재 grandfathered 33개)
- 시트 디스커버리 후속 — 6단계 24 cells / 8주차 16 cells / 채널별 비용 3 cells / 콜·지·기·소 수임비 / 누적수임비 셀 좌표 확정
