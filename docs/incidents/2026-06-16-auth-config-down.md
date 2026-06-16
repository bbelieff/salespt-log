# 인시던트 2026-06-16 — 프로덕션 로그인 전체 다운 (NextAuth Configuration)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: VPS env 재구성 중 `AUTH_URL`(+admin 변수) 유실 → NextAuth `UntrustedHost`로 `/api/auth/*` 500 → 전 사용자 로그인 불가. `AUTH_URL` 복원으로 복구 + 배포 가드 추가.
> - **누가 읽나요**: 개발자, belie, 에이전트
> - **어떤 기능·작업과 연결?**: `auth.ts`, `lib/config/index.ts`, `.github/workflows/deploy.yml`, VPS `.env.local`/`.env.production`
> - **읽고 나면 알 수 있는 것**: 왜 빌드 success인데 로그인만 죽었나 / `AUTH_URL`·`trustHost`의 역할 / 어떻게 배포 단계에서 차단하나
> - **관련 문서**: `CLAUDE.md` §6.8, docs/playbooks/deploy-vps.md

## 증상
- 모바일/PC 전부 로그인 화면이 Auth.js 에러: "There was a problem with the server configuration."
- `/api/auth/{providers,session,csrf}` 전부 **HTTP 500** (`{"message":"... server configuration ..."}`).
- 공개 home `/` 는 200(겉보기 정상), 하지만 인증 API 500 → **로그인 전면 불가** (수강생 22 + 트레이너 8).
- 빌드·배포는 **success**, pm2 online, 에러로그 0 byte → "롤백할 코드 없음".

## 원인 (런타임 env 손상 — 코드 아님, 백업 diff로 확정)
- 최신 배포 1476c3e(#400 'NEXT_PUBLIC_GUIDE_URL 운영값 설정') = 빌드 success. #400 은
  `.env.production`/`.env.example`/plan 만 변경 → **런타임 코드 0** → git revert 무효.
- **확정 원인**: VPS env **재구성** 과정에서 `.env.production`이 `NEXT_PUBLIC_GUIDE_URL` 한 줄만 남고
  시크릿이 `.env.local`로 이동. 이때 **`AUTH_URL`이 통째로 유실**(+`ADMIN_EMAILS`/`ADMIN_NAMES`/`SHEETS_COHORT_MASTER_ID`).
  작동하던 백업 `.env.production.bak.adminnames`(5/12)와 현재 env 키 **diff로 확정**.
- `auth.ts`는 `trustHost: true` 미설정 + NextAuth v5가 `AUTH_SECRET` 자동 로드 구조.
  Caddy 리버스 프록시 뒤에서 `AUTH_URL`이 사라지자 NextAuth가 `UntrustedHost`로 판단 → **auth 핸들러 전체 500**.
- `/`는 auth 핸들러를 안 거쳐 200 → "겉보기 정상, 실제 로그인 다운"의 함정.
- ※ 초기 가설이던 "`echo >>` 줄 붙음(concatenation)"은 env 점검 결과 **반증됨**(모든 키가 라인 시작에 정상 위치). 실제는 AUTH_URL 부재.

## 복구
1. VPS `.env.local`에 `AUTH_URL=https://salesptlog.online` 한 줄 추가 (런타임 변수 → 재빌드 불필요).
2. `pm2 restart salespt-log --update-env` → `/api/auth/providers` 내부·외부 **200** + Google provider `callbackUrl` 올바른 도메인 복구 확인.
3. 유실 admin 변수 3개는 백업(`.env.production.bak.adminnames`)에서 복원(후속).

## 2차 사고 (복구 중 발생 — 기록)
- **PowerShell `\n` mangling**: `printf "\nAUTH_URL=...\n" >> .env.local`을 PowerShell→ssh→bash로 보내자 백슬래시가 먹혀 `nAUTH_URL=https://salesptlog.onlinen`(변수명·값 둘 다 오염)으로 입력 → 여전히 500. → `sed`로 불량 줄 삭제 + `echo`(백슬래시 불요)로 재투입해 해결.
  - **교훈**: PowerShell→원격 bash 전달 시 `\n` 등 백슬래시 escape 의존 금지. `echo`(자동 개행) 사용.
- **deploy.yml 작은따옴표 near-miss**: 배포 가드 주석에 작은따옴표(`'='`)를 넣어, `REMOTE='...'`로 감싸인 원격 스크립트 문자열이 조기 종료될 뻔함(머지 전 발견·수정). → 주석 따옴표 제거 + `REMOTE='` 직후 경고 주석 추가.
  - **교훈**: `REMOTE='...'` 블록 내부 작은따옴표 절대 금지. 따옴표 필요 시 큰따옴표만.

## 재발 방지
- ✅ **배포 가드 (이 PR)**: `.github/workflows/deploy.yml`에서 `git reset` 직후·빌드 전에
  `AUTH_SECRET`·`AUTH_GOOGLE_ID`·`AUTH_GOOGLE_SECRET`·`AUTH_URL` 존재(+빈값 아님) 검증. 하나라도 없으면 `exit 1`
  → **깨진 auth env로 빌드·배포되는 것을 차단** (로그인 죽은 채 배포 불가).
- 시크릿은 `.env.local`(untracked)에만, 공개 `NEXT_PUBLIC_*`만 커밋 `.env.production`.
- env 추가는 백업 → diff 검증 → 재시작 순. 시크릿 단일 파일 일원화 시 누락 키 체크리스트 필수.
- (선택) `auth.ts`에 `trustHost: true` 명시 → `AUTH_URL` 의존도 자체 제거. 단 auth 보안 판단 필요(별도 ADR).

## 타임라인
- 2026-06-16 #400 배포 후 로그인 다운 감지 → 코드 무관·VPS auth env 손상 확정(백업 diff) →
  `AUTH_URL` 복원 + pm2 restart로 복구 → 배포 가드 PR로 재발 차단.
