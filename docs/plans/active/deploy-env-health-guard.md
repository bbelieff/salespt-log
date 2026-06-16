---
slug: deploy-env-health-guard
status: active
created: 2026-06-16
owner: belie
related: deploy-vps
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: VPS env 손상(AUTH_*·ADMIN_EMAILS)을 배포가 잡아 실패시키는 health 가드.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: app/api/health, .github/workflows/deploy.yml
> - **읽고 나면 알 수 있는 것**: 왜 필요, 어떻게 잡나
> - **관련 문서**: docs/incidents/2026-06-16-auth-config-down.md, playbooks/deploy-vps.md

# 배포 env 검증 가드 (env 손상 재발 방지)

## 배경
2026-06-15~16 반복 사고: VPS env 줄 붙음/누락으로 AUTH_*·ADMIN_EMAILS 깨짐 →
로그인 다운 / 관리자 강등. 그런데 홈 `/` 는 200이라 **빌드·배포 success**(겉보기 정상).
같은 사고 3회 → 기계 가드 필요(Hashimoto).

## 구현
- `GET /api/health`: 필수 server env(AUTH_SECRET|NEXTAUTH_SECRET·AUTH_GOOGLE_ID·
  AUTH_GOOGLE_SECRET·ADMIN_EMAILS>0) 존재를 boolean 으로 검사. 하나라도 비면 **503**
  (값은 노출 안 함).
- `deploy.yml` Health 단계: pm2 restart 후 `/api/health` HTTP 코드 검증, 200 아니면
  `exit 1` → 원격 스크립트 실패 → 배포 빨강. env 점검 안내 메시지 출력.

## 효과
- env 가 깨진 채 배포되면 즉시 배포 실패로 인지 → 겉보기 200·실제 다운 사고 차단.

## 상태
- 2026-06-16 진행(chore/deploy-env-health-guard).
