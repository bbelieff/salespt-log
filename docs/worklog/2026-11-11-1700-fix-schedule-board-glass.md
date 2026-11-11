## 2026-11-11 · 주간 보드 유리 재질 맞추기
- 브랜치 `fix/schedule-board-glass`(origin/master). 요청: belie 「지금 라이브되고 있는 버전이 이게 아닌데?」 — 운영 보드가 시안 v43 유리 재질 없이 흰 판으로 나감.
- 원인: #1411 구현 때 시안 CSS(.backdrop·.glass·.weeknav·.mt)를 옮기지 않고 공용 `surface-panel` 을 씀.
- 변경: `board/week-board.css`(이 화면 전용 .wb-*), WeekBoard 왼쪽 판 세 장·빛 번짐, BoardTitle 보라 유리, WeekGrid 선 색·일|월 경계·블록 유리, board-style 상태 바탕 75%.
- 검증: 합성 데이터 화면 1600×900 시안 대조. check.sh·CI 결과는 PR.
- [plan](../plans/completed/schedule-board-glass.md)
