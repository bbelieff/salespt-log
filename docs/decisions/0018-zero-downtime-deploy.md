# ADR-0018: 무중단 배포 — .next swap + pm2 reload + 헬스 게이트

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 배포 다운타임(~4-5분 502)을 없애기 위해 옛 `.next` 보존 빌드 → 원자 swap → `pm2 reload` → 헬스 게이트/롤백을 채택한 결정.
> - **누가 읽나요**: 개발자, 운영자, 에이전트
> - **어떤 기능·작업과 연결?**: `deploy.yml`, `next.config.mjs`
> - **읽고 나면 알 수 있는 것**: 왜 swap 방식인가 / cluster reload 의 전제 / 대안 대비 트레이드오프
> - **관련 문서**: [plan](../plans/active/zero-downtime-deploy.md), `CLAUDE.md` §6.8

- **Status**: accepted
- **Date**: 2026-06-16
- **Supersedes**: 없음 (§6.8 배포 절차 보강)

## 맥락
기존 배포는 `rm -rf .next && npm run build && pm2 restart`. 빌드~재시작 동안 앱이 죽어
루트가 0KB/502 (2026-06-16 모바일 실관측). PR 머지가 잦을수록 다운 노출 빈도↑.
런타임 부하는 작아(앱 ~44MB/3.8GB) **서버 확장은 무관** — 배포 *방식* 문제.

## 결정
1. **distDir 분리 빌드**: `next.config.mjs distDir = BUILD_DIST_DIR || ".next"`. 배포 빌드만
   `BUILD_DIST_DIR=.next-build` → 옛 `.next` 보존(빌드 내내 옛 앱 서빙).
2. **원자 swap**: `mv .next .next-prev; mv .next-build .next`. rename 은 inode 유지 →
   running 프로세스는 swap 후에도 옛 빌드 계속 서빙(끊김 없음).
3. **`pm2 reload`(rolling)**: cluster 모드에서 워커 하나씩 교체. 실패 시 `pm2 restart` 폴백.
4. **헬스 게이트 + 자동 롤백**: 컷오버 후 `/api/health` 200 아니면 `.next-prev` 복원 + reload,
   `.next-broken` 보존, 배포 실패(빨강). 빌드 실패는 swap 전 BUILD_ID 검증에서 차단.

## 대안
- **releases/<sha> + `current` 심볼릭링크 스왑(풀안)**: 가장 견고(완전 격리·즉시 롤백)하나
  pm2 app 경로를 심볼릭링크로 바꿔야 해 운영 pm2 재구성 필요 → 위험·범위 큼. **distDir swap
  이 같은 효과를 pm2 재구성 없이** 달성하므로 최소안 채택.
- **빌드 후 `pm2 restart`만(swap 없이)**: 빌드 윈도우 502 그대로 → 기각.
- **서버 확장**: 빌드 속도만 개선, 502 원인(앱 죽임)은 그대로 → 기각.

## 결과
- 배포 다운타임 0 (빌드 동안 옛 앱 서빙, reload 는 rolling). 빌드/기동 실패도 무중단(옛 빌드 유지·자동 롤백).
- 디스크: 빌드 중 일시적으로 `.next` + `.next-prev` + `.next-build` 공존(~3×, VPS 38G 여유 충분).
- 첫 배포는 새 deploy.yml 가 자기 자신을 배포(부트스트랩) → §6.8대로 관찰. 결함 시 헬스 게이트가 자동 롤백.
- 후속(별도): cluster `instances:2` 상향, releases/<sha> 풀안, 자동 머지 파이프라인.
