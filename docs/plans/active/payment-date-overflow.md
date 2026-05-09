---
slug: payment-date-overflow
status: active
created: 2026-05-09
worktree: ../wt/payment-date-overflow
---

# fix(payment): 수납일 input 박스 뚫고 나오는 오버플로

iOS Safari `<input type="date">` 가 placeholder 폭으로 intrinsic width 를 잡아
grid cell 밖으로 흘러나옴. 부모 `min-w-0` + input `appearance-none` 으로 강제.
