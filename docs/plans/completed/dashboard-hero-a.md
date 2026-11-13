---
status: completed
slug: dashboard-hero-a
created: 2026-11-13
owner: belie
completed: 2026-11-13
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 맨 위 띠 A안 — PC 는 진행 줄과 기간 칩을 한 줄로, 재무는 매출·비용·영업이익·진행건 네 칸 + 칸 아래 미리보기 두 줄. 폰은 그대로.
> - **누가 읽나요**: 개발 세션·belie
> - **어떤 기능·작업과 연결?**: `app/(app)/dashboard/page.tsx`, `components/dashboard/{DashboardFinance,FinanceSummaryBoxes,FinanceWorkColumn,DashboardWorkStatus,DashboardProgressBanner}.tsx`, `components/payment/WorkStatusBar.tsx`
> - **관련 문서**: [components §9](../../design/components.md) · 승인 목업 「시스템 검토」 4절 A안

# 대시보드 맨 위 띠 A안

## 목표·수용 조건
1. PC(≥1024): 진행 줄(날짜·N주차·진행바·%·D-day)과 기간 칩(전체·이번 달·이번 주·직접 설정)이 한 줄 — 진행 왼쪽, 칩 오른쪽.
2. PC 재무는 네 칸 균등: 매출·비용·영업이익·전체 진행건. 큰 숫자 아래 늘 보이는 두 줄(수임비·수수료 / DB 비용·추가 비용 / 이익률·계약 N건 / 상태별 건수).
   매출·비용·영업이익을 누르면 지금처럼 그 칸 아래에만 상세. 진행건은 그 칸 아래 실무/수납과 같은 진행 막대(상태별 목록 팝업).
3. PC 에서 아래 「전체 진행건」 판을 숨긴다. 폰(<1024)은 지금 그대로 — 세 칸 숫자, 미리보기·네 번째 칸 없음, 진행건 판 제자리.
4. 조회·계산은 그대로(새 API 호출 없음), 접근성(button·aria-expanded/controls)·`formatWon`·한 줄 맞춤 유지.

## 변경
- 페이지가 기간 상태(`useFinancePeriodState`)를 갖고 진행 줄 옆에 `PeriodPicker` 를 한 벌 그린다. `DashboardFinance` 는 `periodState` 를 받으면 칩을 그리지 않는다(시험·합성 화면은 지금처럼 자기 칩).
- 진행건 자료는 `useDashboardWorkItems`(DashboardWorkStatus 에서 뽑음) — 아래 판과 같은 조회 키.
- `FinanceWorkColumn.tsx`(새 파일): 네 번째 칸·미리보기(`FinancePreview`)·상태별 두 줄(`workPreviewLines`)·상세(`FinanceWorkDetail`).
- `WorkStatusBar`: `STATUS` 를 내보내고 `popoverAlign?: "pointer" | "end"`(기본 pointer) 추가 — 실무/수납 모양·동작은 그대로.
- 진행 줄은 PC 에서만 「M/D 시작」·「종강총회」 글을 숨긴다(자리 확보, D-day 유지).
- CSS: `.dashboard-work-status-slot` 을 1024 이상에서 `display:none`.

## 검증
- `npx tsc --noEmit -p .` 통과, 관련 vitest 15파일 141건 통과(새 `tests/components/dashboard-hero-a.test.ts` 10건 포함), eslint 대상 파일 통과.
- 실제 화면(PC·폰) 캡처 확인: 이 작업 세션에서는 NOT_RUN — 병합 전 총괄이 확인.

## 위험·복구
- 화면만 바뀐다(데이터·API 그대로). 문제 시 PR revert.
