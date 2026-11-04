---
slug: payment-slot-dday-delete-confirm
status: completed
created: 2026-11-05
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch fix/payment-slot-dday-delete-confirm)
---

# 실무/수납 — 진행건 D? · 진행건 삭제 확인 · 모바일 자동저장 스크롤 고정

## Intent (왜)
- belie 2026-11-05: 「진행2 todo 잡았는데 D?로 나온다」.
- belie 2026-11-05: 「모바일에서 todo 작성하는데 자동저장하면서 스크롤이 아래로 내려가 헷갈려 — 고정해 줘」.
- belie 2026-11-05: 「진행건 삭제는 오타로 실수 삭제 가능 — 팝업으로 번호와 내용 보여 주고 확인받고 삭제」.

## Acceptance Criteria (수용 기준)
- [x] 목록 D-day 칩이 진행건 상세와 같은 기준(todoSlotOf — 진행건 번호, 번호 없는 옛 기록은 기관 이름)으로 기록을 잇는다 — 기관 칸을 나중에 고친 진행건도 D-day 가 보임
- [x] 진행건 ✕ → 확인 팝업(번호·적힌 내용) → 「진행 N 지우기」에서만 지움, 취소는 그대로
- [x] 자동저장·기록 추가로 다시 그려질 때 적고 있는 칸이 화면에서 제자리(`useKeepFocusedInPlace`), 빠른 추가 뒤 포커스는 preventScroll
- [x] 시험: D-day 2개, 삭제 확인 3개, 제자리 3개 · check.sh · build

## 한계
- 스크롤 튐은 PC 브라우저의 휴대폰 흉내(375px)에서 재현되지 않았다. 실제 휴대폰에서 확인 필요 — 원인과 무관하게 「포커스 칸의 화면 위치가 바뀌면 되돌림」으로 막는다.

## Log
- 2026-11-05 구현·합성 화면 확인(삭제 팝업 취소/확인).
