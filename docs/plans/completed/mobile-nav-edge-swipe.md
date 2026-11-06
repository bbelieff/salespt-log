---
slug: mobile-nav-edge-swipe
status: completed
created: 2026-11-07
worktree: .claude/worktrees/adoring-elgamal-f3fa2d (branch fix/mobile-nav-edge-swipe)
---

# 메뉴 서랍: 왼쪽 끝 밀기가 뒤로 가기로 새는 문제

## Intent (왜)
- belie 2026-11-07: 「사이드탭 왼쪽에서 오른쪽으로 슬라이드하면 뒤로가기가 더 많이 됨 — 뒤로가기 말고 사이드탭이 항상 나왔으면」. #1349 의 밀기 리스너가 passive 라 브라우저 뒤로 가기 제스처를 막지 못했다.

## Acceptance Criteria (수용 기준)
- [x] 왼쪽 24px 안에서 시작한 터치(버튼·링크·입력 칸 위 제외)는 touchstart 기본 동작을 막아 서랍이 받는다
- [x] 모바일 터치 화면 `overscroll-behavior-x: none` — 가로 끝 밀기 뒤로 가기(크롬) 끔
- [x] 가운데서 시작한 터치는 그대로(스크롤·탭), touchmove 는 계속 passive
- [x] 시험: claimEdgeTouch, 왼쪽 끝 touchstart defaultPrevented, 가운데 미차단
