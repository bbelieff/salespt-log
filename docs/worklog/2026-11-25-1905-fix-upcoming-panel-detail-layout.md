## 2026-11-25 · 「예정된 일」 창 — 펼친 줄을 이유·정보 두 묶음으로
- 브랜치 `fix/upcoming-panel-detail-layout`. belie 2026-11-25 「예정된 일 창의 펼친 줄도 같이 바꿔줘」 — [plan](../plans/completed/upcoming-panel-detail-layout.md).
- 변경: 펼친 상세를 `FollowUpDetail` 공용 조각으로 빼 할 일 줄과 창이 같이 씀. 창은 업체·해야 할 일을 정보 맨 앞에 유지. 옛 `.ft-expanded` 글·칸 규칙 삭제.
- 세는 규칙·조회·API·DB 변경 없음.
- 시험: 창의 펼친 줄 구조·되풀이 없음, 할 일 줄 기존 시험 유지.
- 검증: 관련 시험 + `scripts/check.sh` + production build, 합성 실화면 PC·폰.
- 미완료: 운영 로그인 화면은 확인하지 못함.
