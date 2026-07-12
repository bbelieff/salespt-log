---
status: completed
slug: auth-api
created: 2026-05-11
worktree: ../wt/auth-api
completed: 2026-05-11
archived: 2026-07-12
---

# feat(auth): NextAuth + API routes (PR-B2)

PR-B1 (백엔드 service) → PR-B2 (NextAuth + API routes) → PR-B3 (UI).

## 추가

### NextAuth 5
- `auth.ts` (root) — Google provider + JWT 1년 maxAge + slide updateAge 1일
- `app/api/auth/[...nextauth]/route.ts` — handlers re-export

### API Routes
- `app/api/me/route.ts` 갱신 — 미등록 시 `{ status: "needs_claim", email }` 응답
- `app/api/claim/route.ts` 신규 — POST `{ cohort, name }` → claimAccount

### Auth Adapter
- `lib/auth/stub.ts` — sync → **async**, NextAuth `auth()` 우선 + STUB 폴백
- 모든 API route 호출자 `await getCurrentUserEmail()` 갱신

## 세션 정책 (사용자 결정)

- maxAge 365일 + updateAge 1일 (sliding window)
- JWT (DB 의존 X)
- 매일 1회 방문 → 자동 1년 갱신 → **사실상 영구**

## Acceptance

- [x] typecheck PASS
- [x] lint PASS
- [x] test:structural PASS (6)
- [x] tests PASS (28)
