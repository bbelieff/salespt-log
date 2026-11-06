---
slug: db-production-mobile-order
status: completed
created: 2026-11-06
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/db-production-mobile-order)
---

# 폰 DB생산: 4채널 고르기를 맨 위, 고르면 입력이 바로 밑

## Intent (왜)
- belie 2026-11-06: 「모바일 db생산 탭에서 보여주는 순서를 바꾸자 4채널 클릭을 우선 넣고 4채널 클릭시 생산 내용을 바로 밑에 두도록」.

## Acceptance Criteria (수용 기준)
- [x] 1024px 미만: 「어떤 DB를 기록할까요?」(4채널) → 고른 채널 입력 → 전체 종합 → 안내 배너
- [x] PC(1024px 이상) 원래 순서(전체 종합 → 채널 → 입력)
- [x] 375px 화면 확인(합성 데이터) · 1280px 순서 유지 확인 · 회귀 시험 1개
