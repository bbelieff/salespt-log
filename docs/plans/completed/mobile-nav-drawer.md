---
slug: mobile-nav-drawer
status: completed
created: 2026-11-07
worktree: .claude/worktrees/adoring-elgamal-f3fa2d (branch feat/mobile-nav-drawer)
---

# 폰·태블릿: 하단 탭 → 덮는 사이드탭 서랍

## Intent (왜)
- belie 2026-11-07: 「모바일 버전에서도 바텀탭이 사이드탭으로 오도록. 모바일은 좌우가 짧으니 접혀 있을 때 아예 안 보이게, 아이콘은 로고 아래 배너 좌측. PC는 사이드탭이 본문을 밀고, 모바일은 덮으면서」.

## Acceptance Criteria (수용 기준)
- [x] 1024px 미만: 하단 탭 없음, 닫힌 사이드탭은 보이지 않음, 배너 왼쪽 메뉴 버튼으로 열면 본문 위를 덮는 서랍(덮개)
- [x] 왼쪽→오른쪽 손가락 밀기로 열림, 반대로 밀면 닫힘(belie 추가 요청) — 입력 칸·가로 스크롤 중·다른 팝업 위에서는 무시
- [x] 덮개·Esc·닫기 버튼·화면 이동으로 닫힘, 초점 이동, 뒤 스크롤 잠금
- [x] PC: 지금 그대로(본문 밀기·접기), 배너 막대 그대로. 관리자·트레이너 화면 무변경
- [x] 토스트·「오늘 챙길 일」 등 하단 탭 높이를 쓰던 것은 안전 영역만큼만 띄움
- [x] ADR-0036 · components.md §5 · 구조 시험 갱신, 375px·1280px 실제 화면 확인
