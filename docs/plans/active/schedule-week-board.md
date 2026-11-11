---
slug: schedule-week-board
status: active
created: 2026-11-11
worktree: .claude/worktrees/step3-meeting-booking-tab-b26456
---

# 일정·계약 탭 주간 보드 (STEP 3 미팅예약 탭 고도화)

## Intent (왜)
belie 2026-11-10 「스텝3 미팅예약 탭 고도화 — 주간 이슈·목표를 왼쪽에, 구글 캘린더처럼 07~22시 격자, 맨 아래(→위) 일별 메모, 스텝4 투두도 전부, 미팅 결과 입력이 주인」. 시안 v1~v43(아티팩트 댓글 반영) 승인 후 2026-11-11 「좋다 이대로 운영반영」.

## Acceptance Criteria (수용 기준)
- [x] PC(1280px+) 한 화면 주간 보드: 제목 칸(주차·수강 주차·주 이동·요일 순서·종류 필터) + 미팅 결과/주간 이슈/트레이닝 목표 판 + 07~22시 격자(메모 줄·종일 줄)
- [x] 미팅을 누르면 기존 결과 카드(계약 장부 연결·되돌리기·추가 미팅·삭제 포함)가 그대로 열린다
- [x] 실무 투두: 업체명부터, 겹치면 한 칸에 줄로, 누르면 완료·결과·다음 할 일(실무수납 탭과 같은 저장)
- [x] 빈 시간 → 일반 일정, 종일 줄 → 종일 일정(type 일반, 계약 없음)
- [x] 일별 메모·주간 이슈 저장(DB schedule_notes, 수강생별)
- [x] 금~목 / 월~일 전환(월~일은 수강 주차 경계 표시), 이 브라우저에 기억
- [x] 1280px 미만: 기존 날짜 목록 + 주간 이슈 판 + 날짜별 메모·투두·일정·시트
- [ ] 운영 DB 에 0022 적용(db-migrate) 후 메모·이슈 저장 확인
- [ ] `bash scripts/check.sh` · production build · CI 통과, 병합·배포·health 확인

## 범위 밖(다음)
- 기간 일정(시작일~종료일): 투두에 끝나는 날 칸이 없음 → 시트 열·구글 캘린더 연동까지 바꾸는 별도 작업.
- 일반 일정 끝 시각: 같은 이유로 시작 시각만(격자에는 1시간 블록).
- 폰 화면의 요일 순서 전환·종류 필터: 이번엔 PC 보드에만.

## Context
- 시안: [docs/design/prototypes/schedule-week-board.html](../../design/prototypes/schedule-week-board.html)
- 데이터: [data-model.md 일정 보드 메모·주간 이슈](../../domains/data-model.md) · 컴포넌트: [components.md WeekBoard](../../design/components.md)

## Log
- 2026-11-11 구현 — 표·API·훅·보드·폰 추가, 합성 데이터 화면 확인(1440×900, 375).
