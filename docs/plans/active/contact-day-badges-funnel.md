---
slug: contact-day-badges-funnel
status: active
created: 2026-05-16
worktree: ../wt/contact-badges
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택탭 일자 박스에 미팅 수 badge + 주간 채널 funnel 합계 (생산/유입/컨택진행/미팅예약) 표시 — 일정·계약 탭과 일관성
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/contact/page.tsx`, `_components/WeekHeader.tsx`, 신규 `WeekFunnelBar.tsx`, `lib/repo/sales.ts`, `lib/service/contact.ts`
> - **읽고 나면 알 수 있는 것**: 컨택탭 헤더에 어떤 정보가 추가됐나? 데이터 출처는?
> - **관련 문서**: [[docs/design/components.md]] §컨택탭

# contact-day-badges-funnel — 컨택탭 헤더 UI

## Executive Summary
사용자 요청 [1]:
- 컨택탭 요일 박스에 미팅 수 badge (일정·계약 탭과 동일 시각)
- 요일박스 아래 금주 채널 funnel 합계 (생산/유입/컨택진행/미팅예약)

## 변경 사항

### `lib/repo/sales.ts`
- **신규** `readWeekFunnel(spreadsheetId, week)` — 영업관리 E~H 의 28 데이터 row 합산.
  - 1주차 row range: 10..37 (blockStart=10, 28 data rows).
  - 1 batchGet 1 range — quota 1 read.
  - 편집 가능 기간 (1~10주) 밖이면 0 fallback.

### `lib/service/contact.ts`
- `ScheduleWeekView` 에 `weekFunnel: { 생산, 유입, 컨택진행, 미팅예약 }` 필드 추가
- `loadWeekMeetings` 가 `findByDateRange + readWeekFunnel` 병렬 호출 → 반환에 포함
- 일정·계약 탭은 weekFunnel 안 씀 (no-op pass-through)

### `app/(app)/contact/_components/WeekHeader.tsx`
- 신규 prop `countsByDay?: number[]` — 일자 박스에 미팅 수 badge 표시
- badge 시각: `bg-blue-500 text-white rounded-full -right-1 -top-1` (일정·계약 탭과 동일)
- 자체 sticky 제거 — parent (page.tsx) 가 WeekFunnelBar 와 묶어서 sticky 처리

### `app/(app)/contact/_components/WeekFunnelBar.tsx` (신규)
- 4칸 균등 grid — 생산/유입/컨택진행/미팅예약 큰 숫자 + 작은 라벨
- 색 강조: gray/amber/indigo/green

### `app/(app)/contact/page.tsx`
- `useWeekMeetings(weekStartISO)` 추가 — weekStart = `friOf(parseISO(date))` (Fri-Thu 주)
- `countsByDay` 계산 → WeekHeader 전달
- `weekFunnel` → WeekFunnelBar 전달
- WeekHeader + WeekFunnelBar 를 sticky div 로 묶음 (일정·계약 탭 패턴)

### docs
- `design/components.md` — WeekHeader 갱신 + WeekFunnelBar 등록

## Quota 영향
- 페이지 진입 시: 기존 `useDay(date)` + 신규 `useWeekMeetings(weekStart)` = 추가 1~2 calls
- `loadWeekMeetings` 내부에서 `findByDateRange + readWeekFunnel` 병렬 → 2 calls (weekStart 변경 시)
- 같은 weekStart 내 day 이동: weekQuery cache hit (변동 없음)
- React Query 기본 staleTime 따라 60s 이내 추가 호출 없음

## Acceptance Criteria
- [ ] 컨택탭 요일 박스에 그 날 미팅 수 badge 표시 (일정·계약 탭과 동일 시각)
- [ ] 요일박스 아래 4칸 funnel 표시 — 생산/유입/컨택진행/미팅예약 숫자
- [ ] 주차 이동 (이전/다음) 시 badges + funnel 갱신
- [ ] 같은 주 내 다른 일자 클릭 시 cache hit (추가 fetch 없음)
- [ ] check.sh 전체 통과

## Log
- 2026-05-16 일자 badges + 주간 funnel 추가
