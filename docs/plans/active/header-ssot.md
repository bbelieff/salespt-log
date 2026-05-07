---
slug: header-ssot
status: active
created: 2026-05-07
worktree: ../wt/header-ssot
---

# Header SSOT 등록 — TopHeader / DDayBadge / brand red / sticky 적층

## Intent (왜)

`TopHeader` 코드는 이미 구현됐지만 `docs/design/components.md` / `docs/design/tokens.md` /
`docs/domains/data-model.md` 어디에도 SSOT가 없어, 다른 세션(예: claude.ai 프로젝트)이
"로고는 어디서 오는지", "기수·이름은 어느 셀인지", "D-day 기준일은 무엇인지",
"#d71617가 brand red인지", "sticky 적층 z-index 규칙"을 알 길이 없음.

CLAUDE.md §6.5 "새 컴포넌트는 docs/design/components.md에 등록 후 구현" 위반.
Hashimoto 원칙으로 SSOT를 박아 재발 차단.

## Acceptance Criteria

- [x] `data-model.md` — 사용자 프로필(B3/C3) + 수강시작일(N1) + D-day target(+49d) + MeProfile 타입
- [x] `tokens.md` — Brand Red `#d71617` + Z-Index/Sticky 적층 표
- [x] `components.md` §8 App Shell — TopHeader 4 그룹 구조 + DDayBadge 표시 규칙
- [x] 세 문서 간 상호 링크 (각각 다른 두 문서를 1번 이상 참조)
- [x] `npm run check` 통과 (docs-only이지만 doc-drift·파일크기 검사)
- [x] PR 머지 후 본 plan은 `docs/plans/completed/`로 이동

## Context

- 코드: `components/TopHeader.tsx`, `components/DDayBadge.tsx`, `lib/service/me.ts`, `lib/query/me-hook.ts`
- 관련 PR(merged): 31a6a2b (헤더 4 의미 그룹), 40780a9 (대시보드 버튼 흰배경/빨간글씨), 198da19 (sticky drift 수정)

## Steps

1. data-model.md → "사용자 프로필 + D-day (TopHeader SSOT)" 섹션 추가
2. tokens.md → Brand Colors 표에 #d71617 + Z-Index/Sticky 적층 새 섹션
3. components.md → §8 App Shell 신설, TopHeader/DDayBadge 등록
4. typecheck/structural/tests 통과 확인 (docs만 변경이라 영향 없음)
5. 커밋·푸시·PR
