---
slug: schedule-phone-meeting-sheet
status: completed
created: 2026-11-15
worktree: .claude/worktrees/kind-bouman-a6d15c
---

# 일정·계약 폰 주 보기 — 미팅 카드를 같은 창(아래 시트)으로

## Intent (왜)
belie 2026-11-15 「폰 주 보기 미팅 카드도 같은 창으로 통일해」. 캘린더 폰 월 보기(#1435)에서 2단계로 미뤄 둔 일.
PC 주간 보드·캘린더(PC·폰)는 미팅을 누르면 같은 창(BoardMeetingPop)이 뜨는데, 폰 주 보기만 줄이 펼쳐지는 옛 카드였다. 한 가지 창으로 맞춘다.
창 모양은 승인된 시안 그대로: docs/design/prototypes/calendar-phone.html (v3)의 미팅 창. 앞 단계: docs/plans/completed/calendar-phone-month.md

## Acceptance Criteria (수용 기준)
- [x] 1280px 미만 일정·계약 목록에서 미팅 줄을 누르면 아래에서 미팅 창이 올라온다(업체정보·길찾기, 결과 4칸, 입력칸, 저장). 줄은 더 이상 펼쳐지지 않는다
- [x] 저장·되돌리기·일정 변경·추가 미팅·지우기는 전과 같은 함수(계약 장부 연결 규칙 불변)
- [x] 옛 카드에만 있던 것을 잃지 않는다 — 사유 「빠른 선택」 칩(완료·변경·취소), `?focus=`(창을 한 번 연다 + 줄 스크롤·링), `?edit=schedule`(「변경」이 골라진 채로)
- [x] 첫 안내(결과 기록)가 창 방식에서도 이어진다 — 미팅 줄 → 창의 결과 4칸, 말풍선이 4칸을 가리지 않는다
- [x] PC 주간 보드의 칸 옆 창은 모양이 그대로다(칩은 아래 시트에서만)
- [x] `bash scripts/check.sh` 통과, 합성 화면 390×844 · 900×760 · 1440×900 확인 — CI·배포·로그인 화면은 worklog

## 치운 것
옛 펼침 카드 `MeetingResultCard` 와 그 안에서만 쓰던 `DoneForm`·`CancelForm`·`RescheduleForm`, `state-map` 의 `CARD_CLS`·`CARD_LABEL`. 이 파일들을 가리키던 가드 시험 4곳은 같은 내용을 새 창(BoardMeetingPop)에서 보도록 대상만 바꿨다.

## 옛 카드와 달라지는 것
- 「📅 예약일」 줄은 창에 없다(PC 보드·캘린더 창과 같음).
- 업체정보 입력칸은 늘 펼쳐져 있지 않고 요약 + 「고치기」.

## 범위 밖
PC 주간 보드에서 `?edit=schedule` 로 들어왔을 때 「변경」 미리 고르기(지금은 창만 열린다), `MapRouteButton` 버튼 부품 정리(함수는 BoardCompanyRoute 가 쓴다), 좌우로 쓸어 달 넘기기, 끌어서 옮기기.
