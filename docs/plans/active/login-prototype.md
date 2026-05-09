---
slug: login-prototype
status: active
created: 2026-05-09
worktree: ../wt/login-prototype
---

# docs(design): 로그인 / Self-claim / 로그아웃 팝업 프로토타입

## 결정사항 (사용자 2026-05-09)

- 보안 약함 모델: 링크만 있으면 누구나 시도, Google 로그인으로 본인 확인
- 미등록 차단 화면 X. 첫 진입 시 기수+이름 매칭 → registry email claim
- claim 시 본인 시트 01 영업관리!B3, C3 자동 입력
- 로그아웃: 좌측 상단 로고 클릭 → 팝업

## 산출물

`docs/design/prototypes/login.html` — 3 state 전환 가능한 프로토타입:
1. **로그인** — 인트로 + Google 버튼
2. **Self-claim** — 기수 dropdown + 이름 dropdown (등록 명단)
3. **로그아웃 팝업** — 좌측 상단 로고 클릭 시 등장 오버레이

상단 우측 state-nav 버튼으로 3 화면 토글.

## 다음 단계 (구현)

- `lib/repo/sales.ts`: writeProfile(spreadsheetId, cohort, name)
- `lib/repo/users.ts`: claimByCohortName(email, cohort, name) — registry email update
- `lib/service/auth.ts`: claimAccount() 흐름
- `app/api/me/route.ts`: 미등록 시 needs_claim 응답
- `app/(auth)/claim/page.tsx`: claim 화면
- `components/TopHeader.tsx`: 좌측 로고 → 팝업
