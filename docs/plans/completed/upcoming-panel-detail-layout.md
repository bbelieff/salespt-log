---
slug: upcoming-panel-detail-layout
status: completed
created: 2026-11-25
worktree: .claude/worktrees/adoring-elgamal-f3fa2d (branch fix/upcoming-panel-detail-layout)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 「예정된 일」 창의 펼친 줄도 할 일 줄과 같은 「이유」·「정보」 두 묶음으로 바꾼다.
> - **누가 읽나요**: 개발 세션(총괄·제작·검증), belie
> - **어떤 기능·작업과 연결?**: `components/dashboard/FollowUpsDetailPanel.tsx`, `FollowUpRow.tsx`(FollowUpDetail), `followups-table.css`
> - **읽고 나면 알 수 있는 것**: 바꾼 것, 확인한 것과 못 한 것
> - **관련 문서**: [펼친 상세 구분 · 오른쪽 열 한 줄](dashboard-task-zone-detail-and-side.md)

# 「예정된 일」 창 — 펼친 줄 구분

## 배경과 승인
- belie 2026-11-25: 「예정된 일 창의 펼친 줄도 같이 바꿔줘」 (#1474 에서 범위 밖으로 남겨 둔 것).

## 결정
1. 펼친 상세를 `FollowUpDetail` 로 빼서 할 일 줄과 창이 같이 쓴다 — 모양·되풀이 제거 규칙이 한 곳.
2. 창은 표가 좁아 업체·해야 할 일이 잘리므로 정보 맨 앞에 두 칸을 다시 보인다(기존에도 있던 칸).
3. 창 안에서는 상세의 바탕·안쪽 여백을 빼고 표 칸 바탕을 쓴다. 옛 `.ft-expanded p/dl/dt/dd` 규칙은 지운다.

## 범위 밖
- 세는 규칙 · 조회 · API · DB. 창의 표 줄 자체.

## 수용 기준
- 창의 펼친 줄에 같은 이유가 두 번 나오지 않는다.
- 할 일 줄의 펼친 상세는 바뀌지 않는다.
