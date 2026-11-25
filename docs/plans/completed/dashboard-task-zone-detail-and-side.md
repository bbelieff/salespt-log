---
slug: dashboard-task-zone-detail-and-side
status: completed
created: 2026-11-25
worktree: .claude/worktrees/adoring-elgamal-f3fa2d (branch fix/dashboard-row-detail-layout)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 할 일 줄을 펼친 상세를 「이유」와 「정보」로 나누고, 오른쪽 열 단계 줄을 한 줄로 고정하며 「세는 기준」을 뺀다.
> - **누가 읽나요**: 개발 세션(총괄·제작·검증), belie
> - **어떤 기능·작업과 연결?**: `components/dashboard/FollowUpRow.tsx`, `FollowUpsSidePanel.tsx`, `DashboardFollowUpsView.tsx`, `dashboard-task-zone.css`
> - **읽고 나면 알 수 있는 것**: 바꾼 것, 그대로 둔 것, 확인한 것과 못 한 것
> - **관련 문서**: [줄 칩과 오른쪽 열](dashboard-task-zone-row-chips.md)

# 할 일 구역 — 펼친 상세 구분 · 오른쪽 열 한 줄

## 배경과 승인
- belie 2026-11-25(펼친 줄 캡처): 「이거 좀 디자인적으로 구분이 잘 되게끔 바꿔줘」 — 같은 말(이유)이 세 줄에 되풀이되고 글 덩어리로만 보였다.
- belie 2026-11-25(오른쪽 열 캡처): 「줄 다음줄로 늘어지지 않게 해주고 세는기준은 없애줘도 될 듯 · 칸 너비를 좀 늘릴까」.

## 결정
1. **펼친 상세**: 「이 일이 뜬 이유」(한 줄에 하나, 굵게)와 「정보」(이름표 위·값 아래 칸, 가는 세로선) 두 묶음. 폰은 위아래, PC 는 좌우.
2. **되풀이 제거**: 상세 한 줄(`detail`)에서 이유·할 일·정보 칸과 겹치는 조각을 뺀다. 남는 것(상품·채널·장소)만 정보 아래 한 줄.
3. **오른쪽 열 단계 줄**: 「가장 오래 D+NN · 7일 넘게 N건」으로 줄이고 한 줄 고정(넘치면 말줄임). PC 열 폭 17rem → 19rem.
4. **「세는 기준」 안내 제거**: 버튼과 안내 글 모두.

## 범위 밖
- 세는 규칙 · 조회 · API · DB. 「예정된 일」 창(FollowUpsDetailPanel)의 펼친 줄.

## 수용 기준
- 펼친 상세에 같은 이유가 두 번 나오지 않는다.
- 오른쪽 열 단계 줄의 보조 글이 두 줄로 넘어가지 않는다.
- 「세는 기준」 버튼이 어디에도 없다.
