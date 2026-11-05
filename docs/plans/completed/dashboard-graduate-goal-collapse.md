---
slug: dashboard-graduate-goal-collapse
status: completed
created: 2026-11-05
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/weekly-goal-collapse-graduates)
---

# 대시보드 — 수료생 주간 목표 접기

## Intent (왜)
- belie 2026-11-05: 「졸업한 사람들은 PT과제가 없어지니 주간목표를 접어 놓을 수 있게. 모바일은 대시보드 맨 아래로 옮겨 접어 두고 언제든 펼 수 있게. 한 번 열거나 접으면 기억해서 들어가면 그대로.」

## Acceptance Criteria (수용 기준)
- [x] 수료생(진행도 줄의 수료 판정과 같은 기준)만 대상, 수강 중에는 그대로
- [x] 모바일: 주간 목표가 대시보드 맨 아래, 처음엔 접힘, 「펼치기」로 언제든 펼침
- [x] PC: 원래 자리, 처음엔 펼침, 제목 줄 「접기」로 접힘
- [x] 열고 접은 상태를 이 기기 브라우저에 화면 크기별로 기억(localStorage)
- [x] 시험 3개 · check.sh · build · 합성 화면(375px·1280px) 확인

## Log
- 2026-11-05 구현·합성 화면 확인.
