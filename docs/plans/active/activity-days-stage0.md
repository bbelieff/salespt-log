---
slug: activity-days-stage0
status: active
created: 2026-10-22
worktree: ../wt/claude-activity-days
---

# 영업활동일 판정 — 심리장치 단계 0 (화면 변화 없음)

목적: 매일 기록 동기 장치(주간 활동일·이정표·수료생 루프)의 기준이 될 "영업활동일"을 한 곳에서 판정한다.
읽는 사람: 개발자(Claude·GPT 협업), belie. 관련: web-push-notifications.md, 외부 기획 `개발프로젝트/_docs/경영일지_심리장치_합친안_20261022.md`.

## Intent
지금은 "매일 기록률"을 잴 수 없다. `lib/service/gamification.ts`의 `computeStreak`는 시트 행 날짜 기준이고 화면에서 쓰이지도 않는다.
그래서 열람·날짜 미루기와 실제 영업행동을 가르는 판정을 순수 함수로 먼저 고정한다. 대시보드·푸시·리포트는 이 판정을 나중에 함께 쓴다.

## Acceptance Criteria
- [x] `lib/analytics/activity-days.ts`: `classifyActivity`, `activityDays`, `summarizeWeek`, `cumulativeSalesDays`
- [x] sales: 연락 결과(부재·단순거절·재통화·컨택진행·상담 후 거절)·미팅 예약·미팅 완료/계약·계약·업무 완료. record: 일일 실적 직접 입력·「특이사항 없음 한 줄」. 미컨택·AS예정·미팅 예약/변경/취소 상태값은 제외
- [x] 같은 날 여러 건은 1일, sales가 record보다 우선. 오늘 이후·잘못된 날짜는 세지 않음(미리 깔린 빈 행 대비)
- [x] 주 창은 호출부가 정한다(주간목표의 금~목 `goalWeekWindow`). 영업 요일은 인자(`workdays`, 기본 월~금)로 받는다. **알림 '받는 요일'과 묶지 않는다**(GPT 검수: 알림을 줄여도 영업 요일·목표가 바뀌면 안 됨). 출처는 belie 결정 전. 영업 요일이 아닌 날 = off, 아직 오지 않은 영업 요일 = upcoming(쉬는 날과 구분)
- [x] `weekdays`는 "이번 주 영업 요일 수"라는 사실값일 뿐이다. 주 목표 일수(주 2·3·5일)는 belie 결정 전이라 이 함수가 정하지 않는다
- [x] 화면·API·DB 변경 없음. 기존 `gamification.ts`(XP 가중치) 무변경 → ADR 불요
- [ ] `bash scripts/check.sh` 통과

## 열린 결정 (belie)
- 일일 실적 숫자 직접 입력을 sales로 셀지(현재 record로 둠, 실제 연락 검증 불가).
- 업무 투두는 완료 시각이 저장되지 않는다(`완료여부` boolean만 있음). 다음 단계에서 이벤트 어댑터를 만들 때 완료일 출처가 필요하다.

## Steps
1. 순수 함수 + 합성 시험(이번 PR)
2. 다음 PR: 어댑터(db_sheet_contacts·meetings·contracts·todos → ActivityEvent), PostHog `activity_day_counted`
3. 단계 2: 주간목표 카드 한 줄(시범자만)

## Log
- 2026-10-22 함수·시험 작성(Claude, GPT 협업 스레드 #05-경영일지).
