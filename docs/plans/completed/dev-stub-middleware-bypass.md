---
status: completed
slug: dev-stub-middleware-bypass
created: 2026-06-27
owner: belie
completed: 2026-06-29
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: dev 에서 STUB_USER_EMAIL 만으로 미들웨어도 통과시켜, 로그인 쿠키 없는 fresh 브라우저(헤드리스/preview)가 보호 라우트를 루프 없이 열게 한다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: middleware.ts, lib/auth/identity.ts(STUB fallback)
> - **읽고 나면 알 수 있는 것**: 왜 루프가 났나, 무엇이 dev 전용인가, 프로덕션 무영향 근거
> - **관련 문서**: incident 2026-05-11 ERR_TOO_MANY_REDIRECTS(identity.ts 주석)

# fix — dev stub 인증이 middleware 통과

## 문제
`middleware.ts` 는 NextAuth `req.auth`(세션 쿠키)로만 보호 라우트를 막는데, server component 는
`identity.ts getSessionEmail` 의 STUB_USER_EMAIL fallback 으로도 인증된다. dev 에서 쿠키 없는
브라우저 → 미들웨어가 보호 라우트를 `/` 로 튕김 → `/` 가 STUB 로 authed 판정 → `/dashboard` 로
보냄 → 다시 튕김 → 무한 루프(2026-05-11 ERR_TOO_MANY_REDIRECTS 와 동형). `practice@salespt.local`
은 `.local` 이라 구글 로그인 쿠키 생성도 불가.

## 결정 (프로덕션 무영향이 핵심)
미들웨어에 **identity.ts 와 동일한 dev 가드**를 추가: `NODE_ENV !== "production" && STUB_USER_EMAIL`
이면 `req.auth` 없어도 통과(authed 간주). 미들웨어(쿠키)와 server component(STUB) 판정이 일치 →
루프 제거. NextAuth 레벨 주입은 쿠키 없는 요청엔 `req.auth` 를 채울 수 없어 어차피 미들웨어 분기 필요.

- **프로덕션**: `NODE_ENV==='production'` → 가드 항상 false → 동작 100% 불변(기존 redirect 유지).
- dev 전용·identity.ts 와 동일 조건이라 두 인증 판정이 어긋날 일 없음.

## 검증
- `.env.local` STUB_USER_EMAIL=practice@salespt.local + `npm run dev:no-watch` → 쿠키 없는 fresh
  브라우저로 `/contact /schedule /payment /db /dashboard` 진입 시 루프 없이 연습용 데이터 화면.
- typecheck/lint/test/structural 그린. 미들웨어 stub 가드 단위 테스트 추가.

## Log
- 2026-06-27 middleware dev-stub 바이패스 추가(identity.ts 가드 동형).
