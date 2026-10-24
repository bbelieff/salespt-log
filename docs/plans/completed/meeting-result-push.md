---
slug: meeting-result-push
status: completed
created: 2026-10-25
worktree: ../wt/claude-activity-days (branch feat/meeting-result-push)
---

# 미팅 시작 3시간 뒤 결과 알림

목적: belie 「미팅 시작 후 3시간 후에는 결과 적으라고 알람 보내주면 좋겠다」. 아침·저녁 정기 알림과 별개로 미팅마다 한 번.
관련: [today-meeting-before-time](today-meeting-before-time.md), [web-push-notifications](../active/web-push-notifications.md).

## Acceptance Criteria
- [x] 15분 cron(`dispatchDuePush`)이 사람마다 오늘 미팅 중 「예약」(결과 미입력)이고 시작 3시간이 지난 것을 찾아 미팅마다 한 번 보냄(`<email>:<날짜>:meeting:<미팅id>`), 한 번에 한 건
- [x] 조건: 알림 켬 + 「받을 내용」에 미팅 + 받는 요일. 21:00 이후는 보내지 않음(다음 날 아침 알림이 결과를 물음)
- [x] 문구: 「○○ 미팅은 어떻게 됐어요? 결과를 적어 두면 다음 연락이 쉬워져요.」 → 일정 화면 그 미팅, 업체명 숨김이면 일반 문구
- [x] 마이그레이션 0011: push_deliveries.slot 에 'meeting' 추가(추가만). 적용 전에는 이 알림만 건너뜀(정기 알림 영향 없음)
- [x] 설정 「미팅 결과」 설명에 「미팅 시작 3시간 뒤에도 한 번」
- [x] 시험: 발송·중복·조건·마이그레이션 전 실패 견딤 + 대상 계산·문구

## 정책 변화(belie 지시로 수용)
- 기존 「하루 최대 2회(아침·저녁)」에 미팅마다 1회가 더해짐.

## 남은 일
- 운영 DB 0011 적용(`node scripts/db-migrate.mjs --dry-run` → 적용). 적용 전에는 미팅 결과 알림만 나가지 않음.
