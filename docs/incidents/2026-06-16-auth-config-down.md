# 인시던트 2026-06-16 — 프로덕션 로그인 전체 다운 (NextAuth Configuration)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: VPS env(auth 변수) 손상으로 NextAuth가 초기화 실패 → 전 사용자 로그인 불가.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: 배포 env, NextAuth, .env.production 커밋(#400)
> - **읽고 나면 알 수 있는 것**: 원인, 복구, 재발 방지
> - **관련 문서**: docs/playbooks/deploy-vps.md, inapp-guide-link.md

## 증상
- 모바일/PC 전부 로그인 화면이 Auth.js 에러: "There is a problem with the server configuration."
- `/api/auth/{providers,session,csrf}` 전부 **HTTP 500** (`{"message":"... server configuration ..."}`).
- 공개 home `/` 는 200(정적), 하지만 인증 API 500 → 로그인 불가.

## 원인 (런타임 env 손상 — 코드 아님)
- 최신 배포 1476c3e(#400 'NEXT_PUBLIC_GUIDE_URL 운영값 설정') = **빌드 success**. #400 은
  `.env.production`/`.env.example`/plan 만 변경 → **런타임 코드 0**. 따라서 git revert 무효.
- NextAuth 'Configuration' 500 = 서버 인증 env(`AUTH_SECRET`/`AUTH_GOOGLE_*`/`AUTH_URL`) 누락·손상.
- 유력 트리거: 가이드 URL 적용 과정에서 VPS `.env.local` 에 `NEXT_PUBLIC_GUIDE_URL` 을
  `echo >> .env.local` 로 덧붙일 때 **파일이 개행으로 안 끝나 직전 auth 변수 줄에 붙어** 깨짐.
  (또는 시크릿이 VPS `.env.production` 에 있었다면 #400 의 `.env.production` 커밋이 배포
  `git reset --hard` 때 덮어써 누락.)

## 복구 (VPS env — belie 수행)
1. `pm2 logs salespt-log --lines 80 --nostream` 로 깨진 변수 특정.
2. VPS `/opt/salespt-log/.env.local` 점검 — 붙은 줄 분리, 손상 값 원복.
   - 올바른 `AUTH_SECRET`·`AUTH_GOOGLE_ID`·`AUTH_GOOGLE_SECRET` 값은 belie **로컬 PC `.env.local`** 에 동일하게 존재 → 복사.
   - `AUTH_URL`(=`https://salesptlog.online`) 존재·정상 확인.
   - 수동 추가한 `NEXT_PUBLIC_GUIDE_URL` 줄은 삭제(이미 커밋된 `.env.production` 에 있음).
3. `pm2 restart salespt-log --update-env` → `curl .../api/auth/providers` **200** 확인.

## 재발 방지
- **시크릿은 `.env.local`(untracked)에만**, 공개 `NEXT_PUBLIC_*` 만 커밋 `.env.production`.
- env 추가 시 줄 붙음 방지: `printf '\n%s\n' 'KEY=val' >> .env.local`.
- (검토) 배포 전/health 에 auth 필수 변수 존재 검증 가드 추가.

## 타임라인
- 2026-06-16 #400 배포 후 로그인 다운 감지 → 원인=VPS auth env 손상 확정(코드 무관) →
  VPS `.env.local` 원복 + pm2 restart 로 복구.
