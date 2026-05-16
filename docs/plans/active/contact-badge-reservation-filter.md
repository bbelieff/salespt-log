---
slug: contact-badge-reservation-filter
status: active
created: 2026-05-16
worktree: ../wt/badge-filter
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택탭 일자 badge 가 미팅날짜 기준에서 **예약일 기준**으로 수정 — day view 와 일관성
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/meetings.ts` (findByDateRangeBoth), `lib/service/contact.ts` (ScheduleWeekView), `app/(app)/contact/page.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 5/14 badge=1 인데 5/14 클릭시 카드가 없었나? 어떻게 fix 되나?

# contact-badge-reservation-filter — view 불일치 사고 fix

## Executive Summary
**2026-05-16 사용자 보고 [3]**: 5/14 목요일 badge 1개 있는데 미팅예약 카드가 없음.

**Root cause** (PR #201 내 버그):
- 컨택탭 day card 리스트 = `useDay(date)` → `예약일=date` 필터
- 컨택탭 일자 badge = `useWeekMeetings.daysByMeetingDate` → `미팅날짜=date` 필터
- 두 필터가 다른 키로 카운트 → view 불일치

## Fix

### `lib/repo/meetings.ts` — 신규 `findByDateRangeBoth`
1회 sheet read 에서 두 기준 동시 추출.

### `lib/service/contact.ts` — `ScheduleWeekView` 확장
- `daysByReservationDate` 필드 추가
- `loadWeekMeetings` 가 두 view 모두 반환

### `app/(app)/contact/page.tsx`
- `countsByDay`: `daysByMeetingDate` → `daysByReservationDate`

## Acceptance Criteria
- [ ] 5/14 badge=1 이면 5/14 클릭시 그 미팅 카드 표시
- [ ] 일정·계약 탭 cards 동작 변화 없음
- [ ] check.sh 전체 통과

## Log
- 2026-05-16 PR #201 view 불일치 사고 fix
