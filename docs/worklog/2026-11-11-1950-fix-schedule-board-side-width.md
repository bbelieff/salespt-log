## 2026-11-11 · 주간 보드 왼쪽 판 너비 맞춤
- 브랜치 `fix/schedule-board-side-width`(origin/master 기준). 요청: belie 「너비가 안맞아」(운영 화면 캡처 — 왼쪽 판 3장이 제목 칸보다 좁음).
- 변경: `week-board.css` `.wb-scroll` — 스크롤바 8px, 바깥 여백 `-4px -12px -4px -4px`(스크롤바를 열·격자 사이 틈으로), `WeekBoard.tsx` 에서 `-m-1` 제거.
- 검증: 합성 화면 1440×900 — 제목 칸·판 3장 좌우 경계 일치(미리보기 창 축소 배율로 1px 미만 차이), 넘칠 때 스크롤바 8px 가 틈 안에 표시.
- [plan](../plans/completed/schedule-board-glass.md)
