---
slug: calendar-cell-height-sticky-panel
status: active
created: 2026-06-05
owner: belie
related: calendar-legend-and-wider
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 캘린더 일자 칸 세로(pc:min-h 150→104)를 줄여 빈 여백 제거 + 우측 선택일 패널을 데스크탑 sticky로 스크롤 따라오게.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/calendar/_components/MonthGrid.tsx`, `app/(app)/calendar/page.tsx`
> - **관련 문서**: [[docs/plans/completed/calendar-legend-and-wider]]

# 캘린더 셀 높이 축소 + 우측 패널 sticky

## Intent
1. `pc:min-h-[150px]`(#287)가 과해 빈 칸도 150px → 6줄 그리드가 너무 길어 스크롤 과다.
2. 스크롤 내리면 우측 선택일 미팅 목록/이동버튼이 사라짐.

## 변경
1. **셀 높이**: MonthGrid 셀 `pc:min-h-[150px]→pc:min-h-[104px]` + `pc:p-2→pc:p-1.5`. 날짜+pill 2~3개+"+N" 들어갈 정도. 모바일 `min-h-[84px]` 유지. (캘린더 셀은 기존부터 arbitrary px 컨벤션 — 값만 축소.)
2. **우측 패널 sticky**: 선택일 `<section>` 에 `pc:sticky pc:self-start pc:top-40 pc:max-h-[calc(100vh-11rem)] pc:overflow-y-auto`. 부모 그리드 `pc:items-start`(기존)라 동작. top-40 = 상단 고정 바(메뉴 48+배너 48+월nav top-24) 회피. 길면 자체 스크롤(그리드 독립).
3. 모바일(<pc): sticky 미적용, 일반 흐름 유지(회귀 0).

## Acceptance Criteria
- [ ] 데스크탑 월 그리드 세로 확연히 축소(빈 칸 과대여백 없음), 칸 시간+업체명 여전히 보임.
- [ ] 스크롤해도 우측 패널·이동버튼 계속 보임(sticky), 상단 바와 안 겹침.
- [ ] 모바일 회귀 없음. `npm run check` 통과.

## 범위 밖
- 그리드 폭/비율(이미 #287), 색·구조 변경.

## Log
- 2026-06-05 셀 104px + 우측 패널 sticky top-40.
