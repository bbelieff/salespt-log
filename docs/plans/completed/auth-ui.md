---
status: completed
slug: auth-ui
created: 2026-05-11
worktree: ../wt/auth-ui
completed: 2026-05-11
archived: 2026-07-12
---

# feat(auth): UI — 로그인 + Claim + 로그아웃 팝업 (PR-B3)

PR-B1 (백엔드) + PR-B2 (NextAuth + API) → PR-B3 (UI 마무리).

## 추가

- `app/page.tsx` 갱신 — 서버 컴포넌트, 세션 + registry 상태로 분기
  - 미로그인 → LoginScene
  - 로그인 + 미등록 → /claim redirect
  - 로그인 + 등록 → /dashboard redirect
- `components/auth/LoginScene.tsx` — v10 프로토타입 React 변환
  - Aurora bg + 글래스 도넛 + 8 Fluent 3D 이모지 + 로고 + Google 버튼
- `app/claim/page.tsx` — 기수/이름 form + POST /api/claim
- `components/TopHeader.tsx` — 로고 클릭 → 로그아웃 팝업
- `app/providers.tsx` — SessionProvider 추가
- `middleware.ts` 신규 — (app) 그룹 보호, 미인증 시 / 로 redirect
- `instrumentation.ts` — pre-existing Sentry typedef 충돌 우회

## SSOT
- `docs/design/components.md` §10-7 신설 (LoginScene + Analytics 등재)

## Acceptance

- [x] typecheck PASS
- [x] lint PASS
- [x] structural PASS (6)
- [x] tests PASS (28)
- [x] doc-drift PASS
