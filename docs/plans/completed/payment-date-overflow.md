---
status: completed
slug: payment-date-overflow
created: 2026-05-09
worktree: ../wt/payment-date-overflow
completed: 2026-05-11
archived: 2026-07-12
---

# fix(payment): 수납일 input 박스 뚫고 나오는 오버플로

iOS Safari `<input type="date">` 가 placeholder 폭으로 intrinsic width 를 잡아
grid cell 밖으로 흘러나옴. 부모 `min-w-0` + input `appearance-none` 으로 강제.
