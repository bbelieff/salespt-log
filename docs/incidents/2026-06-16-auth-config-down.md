> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: VPS env 재구성 중 `AUTH_URL`(+admin 변수) 유실 → NextAuth `UntrustedHost` 로 `/api/auth/*` 500 → 로그인 전면 다운 사고 기록 + 재발방지 가드.
> - **누가 읽나요**: 개발자, 에이전트, 운영자
> - **어떤 기능·작업과 연결?**: NextAuth 인증(`auth.ts`), VPS env, 배포(`.github/workflows/deploy.yml`). 가드 = `CLAUDE.md §6.8`.
> - **읽고 나면 알 수 있는 것**: 무엇이 왜 터졌나, 어떻게 복구했나, 어떻게 막나
> - **관련 문서**: [deploy.yml](../../.github/workflows/deploy.yml), [CLAUDE.md §6.8](../../CLAUDE.md), [auth-env-guard plan](../plans/active/auth-env-guard.md)

# 인시던트 2026-06-16 — auth env 유실 → 로그인 전면 다운

## 증상
- `https://salesptlog.online` (`/`) 는 **HTTP 200** → 겉보기 정상.
- 그러나 `/api/auth/providers` 가 **500** + `{"message":"There was a problem with the server configuration..."}`.
- 결과: **수강생 22명 + 트레이너 8명 전원 로그인 불가** (Google OAuth 진입 자체가 500).
- pm2 는 `online`, 빌드·배포는 **success**, error 로그 0 byte → "배포는 됐는데 로그인만 죽은" 형태라 원인 추적이 헷갈림.

## 근본 원인
1. **env 재구성 중 `AUTH_URL` 유실.** 이전 작동 구성(`.env.production.bak.adminnames`, 5/12)에는 `AUTH_URL` + `ADMIN_EMAILS` + `ADMIN_NAMES` + `SHEETS_COHORT_MASTER_ID` 가 있었으나, 시크릿을 `.env.local` 로 통합하는 재구성 과정에서 이 4개가 누락됨.
2. **`auth.ts` 에 `trustHost: true` 없음.** NextAuth 5 는 리버스 프록시(Caddy) 뒤에서 `AUTH_URL`(또는 `AUTH_TRUST_HOST`/`trustHost`)이 없으면 들어온 Host 를 신뢰하지 않아 `UntrustedHost` → 인증 핸들러 전체 500.
3. **#400(`NEXT_PUBLIC_GUIDE_URL` 운영값 설정)은 무관.** 런타임 코드 변경 0 (`.env.production`/`.env.example`/plan 만 변경) → revert 로는 복구 불가. env 가 git 에 없으므로 **100% VPS env 수정**이 유일한 복구 경로였음.

## 복구
1. VPS `.env.local` 에 `AUTH_URL=https://salesptlog.online` 한 줄 추가 → `pm2 restart salespt-log --update-env` (AUTH_URL 은 런타임 변수 → 재빌드 불필요).
2. 검증: 내부·외부 `/api/auth/providers` **200**, Google provider 의 `signinUrl`/`callbackUrl` 이 올바른 도메인으로 응답.
3. 유실된 `ADMIN_EMAILS`/`ADMIN_NAMES`/`SHEETS_COHORT_MASTER_ID` 는 백업(`.env.production.bak.adminnames`)에서 복원.

### 2차 사고 — PowerShell `\n` mangling
- 1차 복구 시도에서 `printf "\nAUTH_URL=...\n" >> .env.local` 을 PowerShell 경유 SSH 로 실행 → **백슬래시가 중간 계층에서 소실** → 파일에 `nAUTH_URL=https://salesptlog.onlinen` (변수명 앞 `n`, 값 끝 `n`) 으로 들어가 **여전히 500**.
- 교훈: **Windows PowerShell → ssh → 원격 bash 체인에서 `\n` escape 를 신뢰하지 말 것.** 줄 추가는 escape 없는 `echo "KEY=VALUE" >> file` 사용(echo 가 개행 자동 부가). 잘못 들어간 줄은 `sed -i "/^badkey=/d"` 로 제거.

## 재발 방지 (이 PR)
- **`deploy.yml` 에 auth env 가드 추가** (`git reset` 직후, build 전): `AUTH_SECRET`/`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`/`AUTH_URL` 중 하나라도 비거나 없으면 `exit 1` → **깨진 auth 빌드가 배포되지 못함**. 다음 배포가 빨갛게 실패해 즉시 인지 가능.
- `CLAUDE.md §6.8` 배포 플레이북과 연결.

## 후속 (별도, 권장)
- `auth.ts` 에 `trustHost: true` 명시 검토 → `AUTH_URL` env 의존 자체를 제거(프록시 단일 도메인 환경에서 표준). 단 Host 헤더 신뢰 정책 변경이라 ADR 후 적용.
- env 단일 원천 정리 — 시크릿이 `.env.local`/`.env.production` 에 흩어져 재구성 시 유실 위험. 운영 env 의 표준 위치·백업 절차 문서화.
