---
slug: admin-users-teams-open-retired-trainer
status: completed
created: 2026-11-03
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/admin-users-teams-open)
---

# 수강생관리 — 팀 박스 기본 펼침 + 퇴출 트레이너 담당에서 빼기

## Intent (왜)
- belie 2026-11-03: 「서울·부산은 펴져 있는 걸 디폴트로, 기수는 접혀 있되 기수를 열면 서울·부산은 펼쳐져 있도록」.
- belie 2026-11-03: 「트레이너 퇴출되어서 이메일로 표기되는데 퇴출 시 자동으로 담당에서도 나가지게」.

## Acceptance Criteria (수용 기준)
- [x] 기수 박스는 기본 접힘, 기수를 열면 안의 팀 박스는 펼침(사용자가 접은 팀은 기억)
- [x] 퇴출된 트레이너(활성 풀에 없음)는 담당 표시에서 사라짐 — 수강생관리·트레이너 화면 공통(TraineeCard)
- [x] 담당을 바꿔 저장하면 그 수강생의 퇴출 잔재도 같이 빠짐
- [x] 운영 기록을 한꺼번에 고치지 않음(trainer-recruitment remove 의 「자격만 회수, 배정 일괄 재작성 금지」 설계 유지 — 권한은 자격 재확인으로 이미 막힘)
- [x] `bash scripts/check.sh` · production build

## Log
- 2026-11-03 팀 defaultOpen 늘 true, TraineeCard isActiveTrainer 필터. 시험 admin-cohort-collapsed 갱신 + trainee-card-retired-trainer 3개.
