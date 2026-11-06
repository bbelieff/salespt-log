---
slug: company-ksic-in-grant-filter
status: completed
created: 2026-11-06
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch fix/ksic-in-grant-filter)
---

# 표준산업분류를 공고필터로 옮기고 버튼을 「바꾸기」 하나로

## Intent (왜)
- belie 2026-11-06: 산업분류 줄의 고르기·후보·복사·자동으로 버튼이 너무 복잡하다 — 더 단순하고 명료하게, 공고필터를 활용.
- 제안(2026-11-05 대화)을 belie 가 「제안대로 진행」으로 승인.

## Acceptance Criteria (수용 기준)
- [x] [기업정보] 업종 칸 아래에서 산업분류 줄을 빼고, 공고필터 펼침의 업종 줄 아래에 둔다
- [x] 한 줄 「산업분류 [코드] 이름 (자동) … 바꾸기」 — 버튼은 「바꾸기」 하나
- [x] 코드를 누르면 복사 + 「복사됨」 알림(AppToast)
- [x] 「바꾸기」 목록: 고른 값이 있으면 맨 위 「자동 추천으로 두기」(빈값 저장) · 2·3순위 · 찾기 — 줄을 누르면 저장하고 닫힘
- [x] 저장 값·좌표(04 CJ · 06 BR)·TXT 내보내기 변화 없음
- [x] 가상 값 시험 2개 추가 · check.sh · build · 실제 화면(모바일/PC)

## Log
- 2026-11-06 구현·시험.
