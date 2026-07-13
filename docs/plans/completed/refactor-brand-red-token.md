---
status: completed
slug: refactor-brand-red-token
created: 2026-05-08
worktree: ../wt/brand-red
completed: 2026-05-11
archived: 2026-07-12
---

# refactor: brand-red 토큰화 코드 정합

## Intent

Q2 A 결정으로 `tailwind.config.ts` 에 `brand-red` 토큰을 등록했으나
기존 코드(`components/TopHeader.tsx`)는 여전히 arbitrary `[#d71617]` 사용 중.
SSOT(tokens.md)와 코드 정합 맞춤.

## Acceptance Criteria

- [x] `components/TopHeader.tsx` — `border-[#d71617]` / `text-[#d71617]` → `border-brand-red` / `text-brand-red`
- [x] `docs/design/components.md` JSX 예제 동기화
- [x] `docs/handoff/header-ssot.md` JSX 예제 + 체크리스트 동기화
- [x] `docs/design/tokens.md` "follow-up PR" 문구 제거 (완료 표시)
- [x] `tailwind.config.ts` 주석 정리
- [x] `npm run check` 전체 PASS

## Scope

**1개 코드 파일 + 4개 문서 동기화**:
- 코드: `components/TopHeader.tsx` (1곳, 2개 클래스 치환)
- 문서: `components.md` / `handoff/header-ssot.md` / `tokens.md` / `tailwind.config.ts`

**제외**:
- `docs/handoff/inbox/` — immutable 보존
- `docs/plans/active/ssot-update-dashboard-2026-05-07.md` — 역사 기록
- 잔존 `[#d71617]` 멘션은 모두 "사용 금지" 정책 reminder
