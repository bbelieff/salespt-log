---
slug: db-read-calendar
status: active
created: 2026-07-09
owner: belie
related: db-read-meetings-banners, db-read-schedule, db-migration-pilot, db-first-unlimited-roadmap
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2 읽기 전환 6호(탭 전환 마지막) — 캘린더 loadMonthMeetings(04 미팅 + 05 실무투두 월 조회)를 파일럿 기수 한정 DB read 로 전환.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/calendar.ts, lib/repo/db/read-daily.ts(readMeetingsFromDb 재사용 + readTodosFromDb 신규), feat/gcal-connect(같은 구역, 이 PR 먼저)
> - **읽고 나면 알 수 있는 것**: 왜 "meetings 확장"이 아니라 todos read 도 필요했나 / todos 가 왜 새 스키마가 아닌가 / showOnCalendar 기본 ON 규칙 보존
> - **관련 문서**: docs/plans/completed/db-read-meetings-banners.md(payload 이중형태·rowToMeeting 재사용)

# R2-6 — 캘린더 읽기 DB 전환

## 사전조사 정정 (프롬프트 예상과 다른 점 — 워크로그 기록됨)
프롬프트는 "meetings DB read 의 날짜 범위 확장으로 끝난다"고 봤으나, loadMonthMeetings 는
**04 미팅 + 05 실무투두** 2개를 읽는다. 다만 todos 는 meetings 와 **완전 동일 구조**
(row_key=A열 id, dual-write=Todo 필드명, backfill=열문자 A..N, rowToTodo 파서) 라
**새 스키마 작업이 아니라 readMeetingsFromDb 의 쌍둥이(readTodosFromDb) 1개 추가**로 끝남
— 설계 리뷰 통과.

## 전환
| read | 대체 |
|---|---|
| findByDateRange(04, "meeting") | readMeetingsFromDb(R2-2) 재사용 + 미팅날짜 월 필터 |
| findTodosByDateRange(05) | readTodosFromDb 신규(쌍둥이) + showOnCalendar && 예정일자 필터 |

→ 파일럿 시트 read 2→0회. loadMonthFromDb 가 두 read 를 Promise.all, 실패 시 전체 시트
fallback + Sentry. 게이트 chooseDailySource 재사용. 정렬(미팅시간/예정시각)·표시문자열 불변.

## 보존 규칙
- **showOnCalendar 기본 ON**: 명시 FALSE 만 제외, 빈 셀/backfill 미포함 키 = true(시트와 동일).
  backfill 은 빈값 skip → K 키 없음 → coerce(undefined) → 파서 `!false`=true.
- 미팅 = 미팅날짜(D열) 기준(캘린더 규약), 예약일 아님.

## 수용 기준 스냅샷
- 정합 테스트: todos 필드명==열문자==시트 파서, showOnCalendar 기본 ON/명시 FALSE, id 없으면 null.
- 캘린더 API sheets_calls 2→0(파일럿). 비파일럿 불변. check 초록.

## Log
- 2026-07-09 구현: read-daily.ts todos 섹션(todoFromDbPayload·readTodosFromDb),
  todos.ts rowToTodo export, calendar.ts 게이트(loadMonthFromDb). 정합 5테스트.
