---
slug: activity-events-adapter
status: completed
created: 2026-10-24
worktree: ../wt/claude-activity-days
---

# 운영 기록 → 영업활동일 이벤트 변환 (심리장치 단계 0 둘째)

목적: #1195 판정 함수가 받을 `ActivityEvent`를 운영 기록에서 만든다. 순수 함수만(읽기 연결·화면은 다음 PR).
읽는 사람: 개발자(Claude·GPT 협업), belie. 관련: [activity-days-stage0](activity-days-stage0.md), 외부 설계 `개발프로젝트/_docs/경영일지_활동일_어댑터_설계_20261023.md`.

## Acceptance Criteria
- [x] `lib/analytics/activity-events.ts` `toActivityEvents(sources)` — repo 타입에 기대지 않는 입력(연락 이력 행은 필요한 칸만)
- [x] 연락 = 연락일 / 미팅 = 예약일(나중에 취소돼도 유지) + 미팅한 날(완료·계약만 인정은 판정 함수가) / 계약 = 계약일(빈값 제외) / 업무 = history만(완료 날짜 없는 todo 제외, 개인 일정 type=일반·분류=기타 제외) / **일일 실적 행은 넘기지 않음**(빈 행과 직접 0건 구분 불가·양수도 직접입력 증거 아님 — GPT 검수 Q3 FAIL 반영). 기록일은 「특이사항 없음 한 줄」 저장소가 생긴 뒤 받는다. 날짜·사람 범위는 호출부가 정함
- [x] 몰아 적은 기록은 그 활동일에 들어가고 오늘을 만들지 않음
- [x] 화면·API·DB 변경 없음
- [x] `bash scripts/check.sh` 통과 (#1214 병합)

## 다음
- 읽기 연결: repo에 연락 이력(`db_sheet_contacts` date·result) 읽기 1개 + service에서 한 사람 분량 조합. 읽기 전용.
- 할 일 완료 날짜(`완료일자`)는 lib/types 공용 계약 변경이라 별도 PR.

## Log
- 2026-10-24 변환 함수·시험(Claude). GPT 설계 검수 Q1 조건부 PASS·Q2 PASS·Q3 FAIL → 일일 실적 제외·개인 일정 제외로 수정.
