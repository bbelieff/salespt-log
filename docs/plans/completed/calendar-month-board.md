---
slug: calendar-month-board
status: completed
created: 2026-11-12
worktree: .claude/worktrees/kind-bouman-a6d15c
---

# 캘린더 탭 PC 한 달 보드 (하늘) — 일정·계약 주간 보드와 「주 | 월」로 묶기

## Intent (왜)
belie 2026-11-12 「캘린더도 이 디자인컨셉으로 고도화」 → 기획안·시안 → 「화면 합치고 입구는 남기기 + 하늘」 「pc는 먼저 진행하고 폰화면기획 따로」.
캘린더는 일정을 누르면 다른 탭으로 넘어가고 디자인이 주간 보드와 달랐다. PC(1280px+)에서 주간 보드와 같은 틀·부품으로 한 달을 보고, 그 자리에서 결과 입력·투두 완료·일정 추가를 한다.
시안: docs/design/prototypes/calendar-month-board.html (v3).

## Acceptance Criteria (수용 기준)
- [x] PC(1280px+) 캘린더 탭 = 한 달 보드: 제목 칸(「11월」·수강 주차·「‹ 이번 달 ›」·요일 순서·종류 필터·「주 | 월」) + 선택한 날 판 + 이번 달 미팅 결과 판 + 구글 캘린더(접힘) + 달력(줄 머리 = 수강 주차)
- [x] 테마색 하늘(제목 칸·오늘·선택·배경 빛·저장 버튼). 미팅 상태색·채널 점·투두·일반 일정 색은 주간 보드와 같음
- [x] 미팅 → 주간 보드와 같은 미팅 창(같은 저장 함수·계약 장부 연결), 투두 → 같은 투두 창, 「+ 일정」 → 일반 일정(종일/시각), 일반 일정 → 보기·삭제
- [x] 선택한 날 메모 = 주간 보드 일별 메모와 같은 기록(schedule_notes). 메모 있는 날은 칸에 표시
- [x] 「주 | 월」: 캘린더 ↔ 일정·계약 탭을 날짜를 지닌 채 오감. 주간 보드 제목 칸에도 같은 버튼. 캘린더 주소·옆 메뉴(사이드탭)의 「캘린더」는 그대로
- [x] 요일 순서(금~목/월~일)는 주간 보드와 같은 설정(`schedule-day-order`)
- [x] 1280px 미만은 기존 캘린더 화면 그대로
- [x] `bash scripts/check.sh` 통과, 합성 화면 PC(1440×900·1280×720) 확인 — CI·배포·로그인 화면 확인은 worklog

## 시안과 다르게 둔 곳
- 수강 주차 줄 머리는 상한 없이 「수강 N주」(주간 보드와 같은 계산). 화면이 기수별 총 주차를 모른다 — 시안 v1 의 「수료 후」는 v3 에서 뺐다.
- 하늘 채움색은 #0369a1(sky-700) — 흰 글자 대비를 맞추려고 시안 v2 의 #0284c7 보다 한 단계 진하게, 시안도 v3 에서 같은 값으로.
- 「이번 달 미팅 결과」는 다른 달을 볼 때 「N월 미팅 결과」.

## 범위 밖
폰 화면(따로 기획), 끌어서 날짜 옮기기, 기간 일정, 일반 일정 수정, 탭 삭제.

## 한 일
1. 메모 읽기 범위: `/api/schedule-notes?days=`(1~42, 기본 7) + `useScheduleNotes(from, issuesWeek, days)` + 라우트 시험
2. 미팅 저장 함수(handlePatch)를 `schedule/_lib/useMeetingPatch.ts` 로 옮겨 두 화면이 같이 씀(본문 그대로, 소스 가드 시험 경로만 갱신)
3. BoardTitle(`unit`·`tone`·`view`·`onView`)·Panel(`iconTone`)·ResultPanel(`title`·`when`·`max`·`extra`)·EventPopover(`chooseTime`)·MeetingPopHead 분리
4. `calendar/_components/board/` MonthBoard·MonthGrid·DayPanel·EventViewPopover + `month-board.css`(`.wb-sky`)
5. calendar/page.tsx 1280px+ 분기·`?date=`, 주간 보드 「월」, GcalConnectCard `collapsed`
6. 문서(components·tokens·data-model·시안)·worklog
