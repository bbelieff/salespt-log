---
slug: 01-auth-onboarding
status: active
created: 2026-04-16
worktree: ../wt/01-auth-onboarding
---

# 01 — 인증 + 온보딩 (MVP 1/4)

## Intent
수강생이 Google 로 로그인하고, 첫 접속 시 기수·이름을 선택해 본인 시트에 귀속되도록 한다. 이후 접속은 세션으로 자동 처리.

## Acceptance Criteria
- [ ] `app/api/auth/[...nextauth]/route.ts` — NextAuth v5 Google provider 동작
- [ ] Google scope: `openid email profile` **+ `https://www.googleapis.com/auth/calendar.events`** (플랜 02 에서 필요)
- [ ] `access_token` / `refresh_token` 을 세션 또는 별도 저장소(초기엔 JWT 암호화 세션)에 보관. 만료 시 자동 갱신
- [ ] 로그인 성공 시 `auth()` 세션에 `email` 존재
- [ ] 첫 접속: `resolveUser(email)` 이 null 이면 `/onboarding` 으로 리디렉션
- [ ] 온보딩: 기수 select + 이름 select (레지스트리에서 해당 기수 필터) → 서버 액션으로 `email ↔ spreadsheetId` 저장
- [ ] 두 번째 접속: 바로 `/` (홈 대시보드)로
- [ ] `npm run check` 통과
- [ ] 모바일/PC 로그인·온보딩 스크린샷 첨부

## Context
- [[docs/architecture.md]] §사용자·인증
- [[docs/decisions/0002-stack-nextjs-sheets.md]]
- [[docs/playbooks/setup-sheets.md]]
- `lib/repo/users.ts` — 이미 `findUserByEmail`, `registerUser`, `listCohortMembers` 구현
- `lib/service/index.ts` — `resolveUser` 이미 구현

## Steps (점진적 공개)
1. 마스터 레지스트리 시트 생성 + 서비스 계정 공유 + 초기 데이터 몇 줄 입력
2. `.env.local` 에 Google OAuth 크리덴셜·서비스 계정 환경변수 주입
3. `auth.ts` (NextAuth v5 config) 작성, `app/api/auth/[...nextauth]/route.ts` 핸들러
4. `app/(auth)/onboarding/page.tsx` + 서버 액션으로 레지스트리 insert
5. `middleware.ts` 또는 레이아웃에서 세션 체크 → 온보딩 리디렉션
6. 홈에서 세션 정보 표시 (임시)
7. 스크린샷 확보 (모바일 · PC)

## Log
- 2026-04-16 plan 작성. 하네스 부트스트랩 직후.
