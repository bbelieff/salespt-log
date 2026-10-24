---
slug: badge-dashboard-chip
status: active
created: 2026-10-24
worktree: ../wt/claude-activity-days (branch feat/badge-dashboard-chip)
---

# 대시보드 배지 칩 — 배지가 어디 있는지 보이게

목적: belie 「시스템 안에 배지가 어딨는지 암시하는 곳이 없다」. 승인 목업(2026-10-24, 「오늘 챙길 일 상자가 더 널널하니 거기」) 그대로 구현·운영 반영.
관련: [badge-collection](../completed/badge-collection.md), 외부 목업 `개발프로젝트/_docs/경영일지_배지칩_목업.html`.

## Acceptance Criteria
- [x] `BadgeChip` — 「오늘 챙길 일」 상자 맨 아래, /badges 링크. 새 배지 > 다음 배지까지 남은 양 > 첫 행동 > 다 모음
- [x] 「다음 배지」 계산을 배지 수집 화면과 공유(`components/badges/badge-next.ts`)
- [x] 로고 메뉴 「배지 수집」 NEW — 이 기기에서 배지 화면을 처음 열 때까지(날짜 하드코딩 금지 G5 때문에 「일주일」 대신 첫 방문 기준)
- [x] 화면 확인 320/375/430/560(PC 왼쪽 열 폭) · 평소/새 배지/0개 — 320 잘림·새 배지 고르기 2건 발견·수정
- [ ] check.sh · build · 병합·배포·운영 확인

## 자율결정
- NEW 표시는 기존 앵커(NewBadge, 하단 탭 점용) 대신 「배지 화면을 처음 열 때까지」 — 앵커는 탭 단위라 헤더 메뉴에 맞지 않고, 날짜 기한은 G5 날짜 하드코딩 금지. 이미 배지 화면을 연 사람에게는 안 보임.
- 칩은 불러오는 중·실패면 안 보임(상자 높이 흔들림 최소, 맨 아래 한 줄).

## Log
- 2026-10-24 구현(Claude). 시험 badge-next 7 + 대시보드·헤더 기존 111 통과.
