---
slug: auth-env-guard
status: active
created: 2026-06-16
worktree: ../wt/auth-env-guard
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 배포 워크플로우에 인증 필수 env(`AUTH_SECRET`/`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`/`AUTH_URL`) 존재 검증을 추가해, env 유실로 인한 로그인 전면 다운(2026-06-16 사고) 재발 차단.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: `.github/workflows/deploy.yml`, NextAuth(`auth.ts`), `docs/incidents/2026-06-16-auth-config-down.md`
> - **읽고 나면 알 수 있는 것**:
>   - 무엇을 검증하고 언제 실패시키는가
>   - 왜 build 전·`git reset` 후에 두는가
> - **관련 문서**: [incident](../../incidents/2026-06-16-auth-config-down.md), [CLAUDE.md §6.8](../../../CLAUDE.md)

# chore(auth-env-guard): 배포 전 인증 env 무결성 가드

## 배경 (2026-06-16 사고)
VPS env 재구성 중 `AUTH_URL` 이 유실 → NextAuth `UntrustedHost` → `/api/auth/*` 500 →
로그인 전면 다운. 빌드·배포는 success, `/` 는 200 이라 겉보기 정상이어서 추적이 지연됨.
상세: `docs/incidents/2026-06-16-auth-config-down.md`.

## 변경
`.github/workflows/deploy.yml` 의 원격 배포 스크립트에서 `git reset --hard origin/master`
직후, `npm ci`/`npm run build` 전에 가드 블록 추가:

```bash
for v in AUTH_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET AUTH_URL; do
  grep -hqE "^$v=." .env.local .env.production 2>/dev/null || {
    echo "FATAL: 필수 auth env [$v] 가 비었거나 없음 — 배포 중단(로그인 보호)"; exit 1; }
done
```

- `^$v=.` — 키가 라인 시작 + `=` 뒤 **최소 1자**(빈값 `KEY=` 도 실패로 간주).
- `.env.local` **또는** `.env.production` 둘 중 하나에 있으면 통과 (Next.js 가 둘 다 로드).
- 실패 시 `exit 1` → 배포 스텝 실패 → **build·pm2 restart 도달 전 차단** → 현재 정상 빌드 보존.

## 왜 이 위치인가
- `git reset` **후**: 최신 코드 기준으로 검사(브랜치 보호와 정합).
- `npm ci`/build **전**: env 가 깨졌으면 비싼 빌드·재시작을 낭비하지 않고 즉시 실패(fail-fast).
- 런타임이 아닌 **배포 게이트**: 운영 중 프로세스는 안 건드리고, "깨진 걸 새로 배포하는 것"만 막음.

## 수용 기준
- [ ] 4개 변수 모두 존재(비어있지 않음) → 가드 통과, 기존 배포 흐름 그대로.
- [ ] 하나라도 없거나 `KEY=`(빈값) → 배포 fail + FATAL 로그.
- [ ] 가드는 `.env.local`/`.env.production` 둘 다 검사(어느 쪽이든 1개면 통과).

## 범위 밖 (별도)
- `auth.ts` 에 `trustHost: true` 추가(= AUTH_URL env 의존 제거) — Host 신뢰 정책 변경이라 ADR 후.
- env 표준 위치·백업 절차 문서화.

## 검증
- `bash scripts/check.sh` 통과 (이 PR 은 `.github/`·`docs/` 만 변경 — 런타임 코드 0).
- 가드 로직은 배포 시 실제 동작(다음 배포 run 의 "Auth env guard" 그룹에서 `auth env OK` 확인).

## Log
- 2026-06-16 사고 복구 직후 가드 작성.
