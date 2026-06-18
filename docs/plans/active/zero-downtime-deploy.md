---
slug: zero-downtime-deploy
status: active
created: 2026-06-16
owner: belie
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 배포 시 옛 `.next` 를 지우지 않고 `.next-build` 에 빌드 → 원자 swap → `pm2 reload` 로 전환해, 매 배포마다 나던 ~4-5분 502 다운타임을 0초로 만든다.
> - **누가 읽나요**: 개발자, 운영자
> - **어떤 기능·작업과 연결?**: `.github/workflows/deploy.yml`, `next.config.mjs`(distDir 오버라이드)
> - **읽고 나면 알 수 있는 것**: 왜 기존 배포가 다운됐나 / 무중단 전환 원리 / 빌드·헬스 실패 시 롤백
> - **관련 문서**: [ADR-0018](../../decisions/0018-zero-downtime-deploy.md), `CLAUDE.md` §6.8

# 무중단 배포 (zero-downtime deploy)

## 문제
기존 deploy.yml: `rm -rf .next` → `npm run build`(~4-5분) → `pm2 restart`. **돌고 있는 앱의 `.next` 를
먼저 지워서** 빌드 동안 앱이 죽고 루트가 0KB/502. Dev가 자주 머지할수록 사용자가 502를 자주 봄.
(2026-06-16 모바일에서 실제 발생.)

## 변경
1. **`next.config.mjs`**: `distDir: process.env.BUILD_DIST_DIR || ".next"`.
   - 런타임(`next start`)·dev·CI 는 env unset → `.next` (무영향). 배포 빌드만 `.next-build`.
2. **`deploy.yml`** (원격 스크립트):
   - `rm -rf .next-build` → `BUILD_DIST_DIR=.next-build npm run build` → **옛 `.next` 보존**(빌드 내내 옛 앱 서빙).
   - `.next-build/BUILD_ID` 검증 — 실패 시 swap 안 함(옛 빌드 그대로 = 빌드 실패도 무중단).
   - 원자 swap: `mv .next .next-prev; mv .next-build .next`. (running 프로세스는 inode 유지로 swap 후에도 서빙)
   - `pm2 reload`(rolling) — 실패 시 `pm2 restart` 폴백.
   - **헬스 게이트**: 컷오버 후 `/api/health` 200 아니면 **자동 롤백**(`.next-prev` 복원 + reload, `.next-broken` 보존) + 배포 실패.

## 왜 이 방식 (releases/<sha> symlink 대신 최소안)
- Dev 제안의 풀안(`releases/<sha>` + `current` 심볼릭링크)은 더 견고하나 pm2 app 경로·심볼릭링크 구조 변경이 필요해 운영 pm2 설정을 건드린다.
- **최소안(.next swap)** 이 동일 효과(빌드 윈도우 502 제거)를 pm2 재구성 없이 달성 → 위험 최소. distDir swap 으로 충분.

## 수용 기준
- [ ] 배포 동안 `curl https://salesptlog.online` 가 **200 연속**(0KB·5xx 0건).
- [ ] 빌드 실패 시 swap 안 함 → 옛 빌드 유지(앱 안 죽음).
- [ ] 컷오버 후 `/api/health` != 200 → 자동 롤백 + 배포 실패(빨강).
- [ ] dev/local/CI 빌드는 `.next` 그대로(무영향).

## ⚠️ 첫 배포 주의 (부트스트랩)
- 이 PR 머지 → 그 배포가 **새 deploy.yml 로 자기 자신을 배포**. 첫 배포는 §6.8대로 끝까지 관찰.
- 만약 새 로직 결함 시: 헬스 게이트가 `.next-prev`(현행 정상 빌드)로 자동 롤백 → 앱 유지. 이후 fix-forward.

## 범위 밖 (PART 2 — 별도)
- 자동 머지 파이프라인(`gh pr merge --auto` + 브랜치 보호 + auto-delete) = GitHub 설정 + gh CLI + "prod 자동배포 코드 자동머지" 리스크 결정 → 별도 PR/작업.
- pm2 cluster `instances: 2` 상향(ecosystem.config) = 선택적 후속(운영 pm2 설정 변경 주의).

## 검증
- `bash scripts/check.sh` 통과. deploy.yml + next.config + docs 만 변경. 런타임 코드 무영향(distDir 는 env-gated).
