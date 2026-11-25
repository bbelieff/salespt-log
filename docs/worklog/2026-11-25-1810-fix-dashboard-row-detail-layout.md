## 2026-11-25 · 할 일 구역 — 펼친 상세 구분 · 오른쪽 열 한 줄 · 「세는 기준」 제거
- 브랜치 `fix/dashboard-row-detail-layout`. belie 2026-11-25 「디자인적으로 구분이 잘 되게끔」·「다음줄로 늘어지지 않게, 세는기준은 없애줘도, 칸 너비를 좀 늘릴까」 — [plan](../plans/completed/dashboard-task-zone-detail-and-side.md).
- 변경: 펼친 상세를 「이 일이 뜬 이유」·「정보」 두 묶음으로(같은 말 한 번만, `followUpDetailNotes`). 오른쪽 열 단계 줄 보조 글을 「가장 오래 D+NN · 7일 넘게 N건」 한 줄로, PC 열 폭 19rem. 「세는 기준」 버튼·안내 제거.
- 세는 규칙·조회·API·DB 변경 없음.
- 시험: 상세 조각 걸러내기, 펼친 상세 구조, 단계 줄 문구, 「세는 기준」 없음.
- 검증: 관련 시험 + `scripts/check.sh` + production build, 합성 실화면 PC·폰.
- 미완료: 운영 로그인 화면은 확인하지 못함. 「예정된 일」 창의 펼친 줄은 그대로.
