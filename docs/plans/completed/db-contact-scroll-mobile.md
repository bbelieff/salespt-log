---
slug: db-contact-scroll-mobile
status: completed
created: 2026-11-06
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch fix/db-contact-scroll)
---

# 폰 DB정보 「컨택내용」을 누르면 업체정보 시작까지 자동으로 내려가기

## Intent (왜)
- belie 2026-11-06: 「모바일, DB정보에서 컨택내용버튼을 누르면 자동스크롤되어서 아래로 내려가도록. 완전바닥 말고 업체정보 시작하는 구간까지만」.
- 폰(699px 이하)은 업체정보·미팅예약 칸이 DB정보 아래에 붙어 열려, 눌러도 화면 밖에서 열려 열렸는지 몰랐다.

## Acceptance Criteria (수용 기준)
- [x] 폰(700px 미만)에서 「컨택내용」으로 열 때 업체정보·미팅예약 칸의 제목 줄이 화면 위에 오도록 부드럽게 스크롤(바닥까지 아님)
- [x] 접을 때·PC 좌우 배치(700px 이상)에서는 스크롤하지 않음
- [x] 움직임 줄이기 설정이면 즉시 이동
- [x] 회귀 시험 1개(db-sheet-ui-controls)

## Log
- 2026-11-06 구현 · 합성 DB시트(tests/browser/db-sheet-live) 375px 확인.
