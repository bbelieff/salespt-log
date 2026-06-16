---
slug: auth-env-guard
status: active
created: 2026-06-16
owner: belie
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 배포(deploy.yml) 시 `git reset` 직후·빌드 전에 필수 auth env 존재를 검증해, env 유실로 로그인이 죽은 채 배포되는 사고를 차단.
> - **누가 읽나요**: 개발자, 운영자
> - **어떤 기능·작업과 연결?**: `.github/workflows/deploy.yml`, 인시던트 2026-06-16
> - **읽고 나면 알 수 있는 것**: 무엇을 검사하나 / 왜 빌드 전인가 / 통과·실패 조건
> - **관련 문서**: [인시던트](../../incidents/2026-06-16-auth-config-down.md), `CLAUDE.md` §6.8

# 배포 전 auth env 무결성 가드

## 배경
2026-06-16, VPS env 재구성 중 `AUTH_URL` 유실 → NextAuth `UntrustedHost` → `/api/auth/*` 500 →
로그인 전면 다운. 그런데 **빌드·배포는 success**라 자동 감지가 안 됐다(`/`는 200). 같은 사고를
기계적으로 막는다.

## 변경
`.github/workflows/deploy.yml` 의 원격 배포 스크립트(`REMOTE`)에서, `git reset --hard origin/master`
직후·`npm ci`/build 전에 검사 단계 추가:
- `AUTH_SECRET` · `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` · `AUTH_URL` 각각이
  `.env.local` 또는 `.env.production` 에 **라인 시작 + 등호 뒤 값 1자 이상**으로 존재하는지 grep.
- 하나라도 없거나 빈값이면 `exit 1` → 배포 스텝 실패(빌드·pm2 restart 도달 전) → 깨진 빌드 미배포.

## 왜 빌드 전인가
- auth env 손상은 빌드 success로 통과하고 런타임(로그인)에서만 터진다 → 빌드 후 검증으론 늦다.
- `git reset` 직후 검사 = 배포될 실제 코드/env 기준으로 가장 이른 시점.

## 수용 기준
- [ ] 4개 변수 정상 시 배포 통과 (현행과 동일).
- [ ] 임의 1개 비우면 배포가 해당 스텝에서 `FATAL ... exit 1` 로 실패.
- [ ] 가드는 VPS env 파일만 검사(시크릿 값 미출력).

## 재발 방지 메모 (이 작업 중 학습)
- `REMOTE='...'` 블록 내부에 작은따옴표 금지(문자열 조기 종료) → 큰따옴표만. deploy.yml `REMOTE='` 직후 경고 주석 박음.

## 검증
- `bash scripts/check.sh` 통과. deploy.yml + docs 만 변경 → 런타임 코드 무영향.
