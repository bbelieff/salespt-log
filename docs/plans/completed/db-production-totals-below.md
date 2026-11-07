---
slug: db-production-totals-below
status: completed
created: 2026-11-07
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/db-production-totals-below)
---

# DB생산: PC 도 전체 종합을 아래로, 채널 합계는 구매목록 추가 아래로

## Intent (왜)
- belie 2026-11-07: 「pc버전에서도 채널합계는 아래로 가도록」 · 「개별채널합계도 구매목록 아래로 위치하도록」 → 정정 「채널합계가 구매목록추가 밑으로」.

## Acceptance Criteria (수용 기준)
- [x] 모든 너비: 채널 고르기 → 고른 채널 작업대 → 전체 종합 → 안내 배너(폰 순서를 PC 에도)
- [x] 채널 작업대: 구매목록(제작목록 등) → 추가 폼 → 채널 합계. 1440px 이상은 왼쪽 목록, 오른쪽 추가 폼·합계
- [x] 합성 화면 1280·1600·375px 확인, 순서 시험 갱신(db-mobile-order · desktop-fluid)
