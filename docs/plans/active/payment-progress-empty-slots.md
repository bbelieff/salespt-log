---
slug: payment-progress-empty-slots
status: active
created: 2026-05-09
worktree: ../wt/payment-progress
---

# fix(payment): 수납진척% — 진행기관 빈 슬롯 모수 제외

문제: 시트는 1계약당 슬롯 3개 미리 생성. 진행기관 미입력 슬롯도 분모에 포함 →
수납진척% 왜곡 (특히 승인금액만 임의 입력된 phantom 슬롯 케이스).

해결: `isActiveSlot(slot) = !!slot.진행기관.trim()` 필터.
분자(수납액합)·분모(승인금액합) 양쪽에서 빈 슬롯 제외.
