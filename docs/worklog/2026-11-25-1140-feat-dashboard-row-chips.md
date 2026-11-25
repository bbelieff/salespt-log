## 2026-11-25 · 할 일 구역 — 줄의 종류·이유 칩 + 오른쪽 열 「단계 · 종류 · 이유」
- 브랜치 `feat/dashboard-row-chips`. belie 「좋다 B로 진행」(2026-11-25) — 기획서 https://claude.ai/artifact/FCc1WcovjEkNjsdSbbCSsd , [plan](../plans/completed/dashboard-task-zone-row-chips.md).
- 변경: 줄에 종류 칩(PC 전체)·이유 칩(넓은 PC, 최대 둘) 추가. 좁은 PC 는 이유 칩과 「STEP n 단계」 글자를 빼 「열기」가 늘 같은 줄. 폰 줄은 그대로.
- 오른쪽 열을 `FollowUpsSidePanel` 로 분리: 「단계 · 종류 · 이유」 보기 전환(미끄러지는 표시), 누르면 목록이 좁혀짐, 보기 전환 시 조건 해제, 목록 위 「…만 보는 중 · 풀기」. 단계 보기는 `StepBadge` 흐름 + 「몰림」 + 가장 오래 밀린 날수. 본 보기는 기기에 기억.
- 분류: `lib/analytics/follow-up-work-kind.ts`(종류 여섯 가지, 이유 쉬운 말). 세는 규칙·조회·API·DB 변경 없음.
- 시험: 분류(문구가 생성 코드에 그대로 있는지 포함), 칩 표시 규칙, 세 보기와 좁히기, 보기 기억, 조회 실패.
- 검증: 관련 시험 + `scripts/check.sh` + production build, 합성 실화면 PC 넓은 폭·좁은 폭·폰.
- 미완료: 실제 수강생의 종류별 비율은 확인하지 못함(가상 데이터로만 봄). 우하단 빠른 보기에는 넣지 않음.
