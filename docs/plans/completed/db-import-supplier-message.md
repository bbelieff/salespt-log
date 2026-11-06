---
slug: db-import-supplier-message
status: completed
created: 2026-11-05
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch fix/db-import-crm-message)
---

# DB관리시트 텍스트 가져오기 — 공급처 알림 글 통째 붙여넣기

## Intent (왜)
- belie 2026-11-05: 공급처가 보내는 「정책자금 신청 알림」(인사말 + 「항목 : 값」 + 안내문)을 그대로 붙여넣어도 제대로 읽어 달라.
- 원인: 항목별 텍스트를 빈 줄로 덩어리를 나눠 덩어리마다 고객 한 건으로 만들어, 인사말·안내문이 빈 고객 5건이 됐다. 「신용점수 700 : 이상」은 「이상」만 남았다.

## Acceptance Criteria (수용 기준)
- [x] 「항목: 값」 줄이 없는 덩어리는 고객이 아니라 다음(없으면 앞) 고객의 원문으로 붙는다
- [x] 「신용점수 700 : 이상」 → 「700점 이상」(표 머리글과 같은 규칙 normalizeImportCredit)
- [x] 모르는 항목(기존 대출·희망 서비스·동의 여부)과 인사말·안내문은 원문 메모에 남는다
- [x] 알림 두 개를 이어 붙이면 두 건
- [x] 가상 값 시험 2개 · 기존 db-sheet 시험 460개 · check.sh · build

## Log
- 2026-11-05 구현·시험.
