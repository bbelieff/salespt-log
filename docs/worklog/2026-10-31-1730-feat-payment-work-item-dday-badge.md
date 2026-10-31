## 2026-10-31 · 실무진행 — 진행건마다 다음 할 일 D-day 배지
- feat/payment-work-item-dday-badge. belie: 진행건이 여럿이고 할 일이 밀렸을 때 접힌 채로도 어느 진행건인지 보이게. 모양 = 목록과 같은 D+N 빨간 배지(belie 선택), 범위 = 오늘·기한 전·기한 후 모두(belie 선택).
- PaymentSlotForm 제목 줄에 `WorkActivityBadge` — 그 진행건(번호, 옛 기록은 기관 이름) 미완료 Todo 의 가장 이른 예정일. History·완료 할 일은 안 셈. `activityLabel` export 해 목록과 같은 표기.
- 검증: 합성 화면 PC — 진행1 D0·진행2 D+03(빨강)·진행3 D-05·완료만 있는 진행4 배지 없음. 되돌리기 = squash revert.
