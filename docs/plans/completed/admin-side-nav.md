---
slug: admin-side-nav
status: completed
created: 2026-11-03
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/admin-side-nav)
---

# 관리자모드 — PC 왼쪽 메뉴(사이드 탭)

## Intent (왜)
관리자 메뉴 사이를 오가려면 매번 「← 마스터 메뉴」로 홈을 거쳐야 한다. belie 2026-11-03: 「풀사이즈시 관리자모드도 사이드탭으로」 → 설계안 권장대로 진행(늘 펼친 메뉴, 관리자모드만).
설계 페이지: https://claude.ai/artifact/JumopLqsgvBAKwhaCStAw1 「사이드 탭 설계안」.

## Acceptance Criteria (수용 기준)
- [x] 1024px 이상에서 관리자 화면 왼쪽에 메뉴(홈·수강생·트레이너·기수·아레나·팝업관리, 바로가기 트레이너 페이지, 로그아웃) 고정
- [x] 지금 화면 강조, 승인 대기 수(수강생·트레이너)를 메뉴 옆 숫자로
- [x] 마스터 전용(팝업관리·트레이너 페이지)은 관리부서 계정에 안 보임
- [x] 아레나 전광판·공유왕(캡쳐용)은 메뉴 없음
- [x] PC 에선 각 화면 맨 위 머리줄(Master·이메일·← 마스터 메뉴) 숨김. 기수 관리는 버튼이 있어 「← 마스터 메뉴」만 숨김
- [x] 1024px 미만(태블릿·모바일)은 그대로
- [x] `bash scripts/check.sh` · production build · 합성 화면 1024·1280·375px

## Context (참고)
- docs/design/components.md — AdminSideNav
- 승인 대기 수는 /admin 홈 카드와 같은 `listPendingTrainees/Trainers`(registry 캐시). 레이아웃은 화면 이동 사이 유지되므로 관리자 구역 진입 때 한 번 읽는다.

## Steps
1. components/auth/AdminSideNav.tsx (client, usePathname)
2. app/admin/layout.tsx — 권한 있는 계정에 메뉴 + 대기 수
3. 관리자 화면 머리줄 `pc:hidden`
4. 시험 tests/components/admin-side-nav.test.ts

## Log
- 2026-11-03 구현·시험 4개.
