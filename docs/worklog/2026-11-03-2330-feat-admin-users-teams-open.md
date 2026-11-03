## 2026-11-03 · 수강생관리 팀 박스 기본 펼침 + 퇴출 트레이너 담당에서 빼기
- feat/admin-users-teams-open. belie 「서울·부산은 펴져 있는 걸 디폴트로, 기수는 접혀 있되 기수를 열면 서울·부산은 펼쳐져 있도록」.
- 담당 파일: `components/auth/AdminUserPickerSections.tsx`·`TraineeCard.tsx`, `docs/design/components.md`, `tests/components/admin-cohort-collapsed.test.ts`·`trainee-card-retired-trainer.test.ts`, [plan](../plans/completed/admin-users-teams-open-retired-trainer.md). 선행 #1301·#1305(병합됨).
- 팀 PersistentDetails `defaultOpen` 늘 true(기수만 `collapsed` 로 접힘). 사용자가 접은 팀은 저장값대로 접힘 유지. 저장 키는 그대로(v2) — 기수 펼침 기억 보존.
- 퇴출 트레이너: belie 「퇴출 시 자동으로 담당에서도 나가지게」. TraineeCard 가 활성 풀(`activeTrainers`)에 없는 담당을 표시에서 뺌, 담당을 바꿔 저장할 때 그 수강생의 잔재도 제거. 운영 기록 일괄 재작성은 하지 않음(trainer-recruitment remove 설계 — 재승인 시 복원, 권한은 자격 재확인으로 차단).
- 되돌리기 = squash revert.
