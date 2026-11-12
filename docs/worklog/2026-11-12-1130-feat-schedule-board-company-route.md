## 2026-11-12 · 주간 보드 미팅 창 업체정보·길찾기 (시안 v44)
- 브랜치 `feat/schedule-board-company-route`(origin/master 기준). 요청: belie 시안 댓글 → v44 → 「목업디자인 준수해서 달라지지 않게 하고 운영반영해」.
- 변경: `board/BoardCompanyRoute.tsx` 새 부품, MeetingResultCard `boardTools`(보드 창에서만 — 길찾기 버튼·업체정보 입력칸 대신 트레이, 「고치기」로 입력칸), `MapRouteButton` 의 `readApp`·`saveApp`·`launch` export, `week-board.css` `.wb-q*`, page.tsx 보드 렌더에 `boardTools`.
- 검증: tsc, 합성 화면 1440×900 — 업체정보 펼침·고치기(입력칸 열림)·길찾기(소재지로 검색·지도 3개·저장 체크), 버튼 글자 넘침 없음. 로그인 운영 화면 NOT_RUN.
- [plan](../plans/completed/schedule-board-company-route.md)
