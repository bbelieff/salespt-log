## 2026-11-12 · 주간 보드 블록 안 글자를 시안 값으로
- 브랜치 `fix/schedule-board-block-type`(origin/master 540eeb6b 기준). 요청: belie 「폰트가 … 아래로 쳐지고 글씨도 선명하지 않음」.
- 앞 작업 기록: #1426(미팅 창·목표 판) 병합 540eeb6b, 배포 run 43183909516.
- 변경: `week-board.css` `.wb-mt*`, `WeekGrid.tsx` 미팅·일반 일정 블록. 문서 components.md.
- 검증: tsc, 합성 화면 — 블록 4개 모두 글자 시작 위치가 위에서 5px, 12px/800. 운영 화면 선명도 NOT_RUN.
- [plan](../plans/completed/schedule-board-block-type.md)
