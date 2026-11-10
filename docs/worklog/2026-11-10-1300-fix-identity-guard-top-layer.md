# 2026-11-10 13:00 fix/identity-guard-top-layer

- 목표: UI 점검 보고서 1-1 — 신원 가드 차단막이 열린 저장 창 아래 깔리는 문제(belie 「진행」).
- 담당 파일: `components/auth/IdentityGuard.tsx`, `tests/components/identity-guard*.test.ts`, `docs/design/tokens.md`, `docs/design/components.md`.
- 변경: 차단막 `z-50` → `z-[20000]`(앱 최고 10000 위), 막히면 초점을 버튼으로·Tab 가둠.
- 검증: vitest 11건 통과. 실제 두 탭 재현 NOT_RUN(로그인 필요).
- 계획: [identity-guard-top-layer](../plans/completed/identity-guard-top-layer.md)
- 위험/복구: 화면만, revert 1건.
