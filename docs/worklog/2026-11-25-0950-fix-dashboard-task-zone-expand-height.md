## 2026-11-25 · 할 일 구역 「모두 보기」가 실제로 펼쳐 보이게
- 브랜치 `fix/dashboard-task-zone-expand-height`(base `d247a098`). belie 「이 세션에서 직접 검수하고 운영반영까지」 — [plan](../plans/completed/dashboard-task-zone-expand-height.md).
- 발견: 총괄이 운영 코드를 합성 화면에서 직접 검수. PC 900 높이에서 접힘 6줄 → 펼침 6.2줄, 폰 812 에서 3줄 → 4.9줄. 「모두 보기」를 눌러도 펼친 것으로 보이지 않았다.
- 변경: `.tz-list[data-open=true]` 높이 한도 23.5rem·26.25rem → 화면 높이의 70%(위 한도 PC 44rem·폰 40rem, `dvh` + `vh` 대체값). 시험 정규식·components.md 동기화.
- 검증: 관련 시험 + `scripts/check.sh` + 합성 실화면 PC 1440×900·폰 375×812 에서 펼친 줄 수 실측.
- 미완료: 0건 접힘 때 아래 구역이 전환 없이 올라오는 것, 좁혀 둔 조건이 0건이 됐을 때의 자동 해제는 손대지 않음(plan 「검수에서 본 것」).
