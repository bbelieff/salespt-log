---
slug: schedule-board-glass
status: completed
created: 2026-11-11
worktree: .claude/worktrees/step3-meeting-booking-tab-b26456
---

# 주간 보드 유리 재질 — 시안 v43과 운영 화면 맞추기

## Intent (왜)
belie 2026-11-11 「지금 라이브되고 있는 버전이 이게 아닌데?」 — 운영 주간 보드(#1411)가 승인 시안 v43의 유리 재질 없이 공용 흰 판(`surface-panel`)으로 나갔다. 왼쪽이 판 하나로 합쳐져 아래가 비고, 빛 번짐·반투명 블록·일|월 경계선이 빠졌다.

## Acceptance Criteria (수용 기준)
- [x] 보드 뒤 보라·하늘·장미 빛 번짐, 격자·왼쪽 판이 유리 판(시안 `.glass` 값)
- [x] 왼쪽은 미팅 결과 / 주간 이슈(옅은 빨강) / 트레이닝 목표 세 장, 사이 12px
- [x] 제목 칸 보라 유리, 미팅·일반 블록 반투명 유리, 금~목 보기 일|월 굵은 선
- [x] 흐림 미지원·투명도 줄이기·강제 색·동작 줄이기 대체
- [x] 공용 `surfaces.css`(유리 금지)는 그대로 — 이 화면 전용 `week-board.css`

## 범위 밖
폰 목록 화면 재질, 다크 모드.
