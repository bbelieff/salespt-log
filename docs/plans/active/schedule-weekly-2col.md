---
slug: schedule-weekly-2col
status: active
created: 2026-06-05
owner: belie
related: tab-width-unify
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정·계약 위클리(7일)를 PC에서 2열(좌 금·토·일 / 우 월·화·수·목)로 분할해 한 화면에. 모바일은 기존 1열 시간순 유지.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/schedule/page.tsx`
> - **관련 문서**: [[docs/plans/completed/tab-width-unify]]

# 일정·계약 위클리 PC 2열

## Intent
7일을 단일 세로 목록으로 렌더 → 풀사이즈에서 세로로 길어 스크롤 과다. PC 2열로 위클리 한 화면에.

## 변경
- `renderDay(day, globalIndex)` 헬퍼 추출(DaySection 블록 1회 유지, dayRefs 글로벌 index 보존).
- 명시 분할(단순 grid 행우선 회피):
  ```
  <div className="pc:grid pc:grid-cols-2 pc:items-start pc:gap-4">
    <div>{slice(0,3).map((d,j)=>renderDay(d,j))}</div>     // 금·토·일
    <div>{slice(3).map((d,j)=>renderDay(d,j+3))}</div>     // 월·화·수·목
  </div>
  ```
- 모바일(<pc): 외곽 비-grid → 두 div 위→아래 = 금토일→월화수목(시간순 동일, 회귀 0).
- dayRefs: 좌 i=j, 우 i=j+3 → WeekHeader 요일 클릭 scrollIntoView 정상.
- WeekHeader·SummaryBar 는 위 전체폭 그대로.

## Acceptance Criteria
- [ ] PC: 좌 금/토/일, 우 월/화/수/목 2열, 위클리 한 화면(스크롤 최소).
- [ ] 모바일: 기존 단일 세로·시간순 그대로.
- [ ] 요일 클릭 시 해당 day 스크롤 정상(dayRefs).
- [ ] `npm run check` 통과.

## 범위 밖
- DaySection 내부·색·데이터 변경.

## Log
- 2026-06-05 renderDay 추출 + pc 2열 명시 분할.
