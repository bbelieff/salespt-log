## 2026-11-01 · DB정보 최초상담일 지우기 · 부재 시간 막대 12시 눈금
- fix/db-sheet-clear-first-contact-date. belie: 최초상담일 달력 「재설정」 무반응 → 지울 수 있게 / 부재 막대 12시 눈금, 「부재 걸었던 시간」 삭제.
- 원인·변경·수용은 docs/plans/completed/db-sheet-clear-first-date.md. 새 서버 필드 `firstCleared`(data-model.md).
- 되돌리기 = squash revert(데이터 변경 없음).
- 추가: DB정보 머리줄 닫기·유입 반영 위치(모바일에서 닫기가 아래로 떨어지던 것).
