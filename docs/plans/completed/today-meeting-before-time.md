---
slug: today-meeting-before-time
status: completed
created: 2026-10-25
worktree: ../wt/claude-activity-days (branch fix/today-meeting-before-time)
---

# 당일 미팅이 아침부터 「미팅 결과 입력」으로 뜨는 버그

목적: belie 「당일 미팅이 아침부터 결과 입력으로 뜨는 버그부터 고쳐서 운영 반영」. 「오늘 챙길 일」과 08:45 아침 알림이 미팅 전인데도 결과를 물었다(`buildUnresultedMeetings` 가 날짜만 비교).

## Acceptance Criteria
- [x] 당일 미팅은 시작 3시간 뒤부터(첫 배포 1시간 → belie 「미팅 후 3시간」으로 변경) 「미팅 결과 입력」, 그 전에는 「오늘 미팅」(이유 `오늘 미팅 예정`, 오늘 묶음에 그대로 셈). 시간을 모르면 그날은 묻지 않음. 지난 날·내일 규칙은 그대로
- [x] 대시보드·빠른 보기: 서울 시각을 5분마다 갱신해 넘김(`useTodayFollowUps`)
- [x] 알림: 발송 시각(`kst.time`)을 넘김. 아침 문구는 결과 대신 「오늘 ○○ 미팅이 있어요. 끝나면 결과를 적어 두세요.」, 저녁에 아직 결과를 물을 때가 아닌 미팅은 「오늘 ○○ 미팅, 끝나면 결과를 적어 두세요.」
- [x] 시험 `tests/components/today-meeting-timing.test.ts` + 기존 대시보드·알림 시험 통과
- [x] check.sh·build — 병합·배포 결과는 worklog

## 자율결정
- 「끝난 미팅」 기준 = 시작 + 180분(`MEETING_RESULT_AFTER_MIN`, belie 2026-10-25). 미팅 길이 저장 칸이 없어서. 되돌리기 = 상수 한 줄.
