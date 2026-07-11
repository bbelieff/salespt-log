# 2026-07-09 · 배포 연결 끊김으로 사이트 다운 (502, 크래시 루프)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: GH러너→VPS 도달성 장애(rc=255)가 배포 원격 스크립트를 실행 **중간에** 끊어 `.next` 가 깨진 채 남음 → `next start` 크래시 루프 → 502(사이트 다운). rerun(재빌드)으로 복구.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **관련 문서**: CLAUDE.md §6.8, .github/workflows/deploy.yml, docs/playbooks/deploy-vps.md, chore/deploy-detached-remote(재발방지)

## 무엇이 터졌나
- 트리거: #516(setup-sheets docs 1줄) 머지 → 자동 배포. 배포 "Deploy on VPS" 단계 **failure** + 공개 health **502**.
- VPS 상태(진단): `git head=e894de6`(정상 머지), **`.next/BUILD_ID` MISSING**(불완전 빌드), `.next-prev`·`.next-build` 부재, pm2 `salespt-log` restarts≈996→1306 크래시 루프(3000 미청취) → 502.
- pm2 로그: `next start` 무한 반복(유효 빌드 없음 → 즉시 크래시 → pm2 재시작 → 반복).

## 원인
- deploy.yml 은 **무중단 원자 스왑 설계**임: `.next-build` 에 빌드 → `test -f .next-build/BUILD_ID`(실패 시 swap 안 함) → `mv .next .next-prev; mv .next-build .next` → pm2 reload → health 게이트 → 실패 시 `.next-prev` 롤백. **설계상 빌드 실패는 무중단**이어야 함.
- 그런데 **원격 스크립트가 SSH 연결 위에서 동기 실행**된다. 이 세션 내내 재발한 **GH러너→VPS:22 도달성 장애(rc=255, provider-edge)** 가 스크립트를 **swap/pm2 reload 부근에서 끊으면** 스크립트가 SIGHUP 으로 죽어 원자성이 깨진 중간 상태(`.next` 손상)로 남는다. 즉 도달성 장애가 "배포 실패(무해)"를 넘어 **사이트 다운**까지 격상.

## 복구
- `gh run rerun <deploy_id> --failed`(새 러너에서 재빌드) → 성공 → BUILD_ID 재생성 → pm2 안정(uptime 회복) → health 200. 공개·로컬 health 200, uptime 안정 확인.

## 재발 방지 (Hashimoto)
1. **[하네스·완료] 원격 스크립트 detached 실행** — `chore/deploy-detached-remote`(2026-07-09). deploy REMOTE 스크립트를 `setsid` 로 연결과 분리해 띄우고, 러너는 상태파일을 폴링. 연결이 끊겨도 스크립트(특히 원자 swap)가 끝까지 완주 → **mid-swap 손상 원천 차단**. VPS 상 `flock` 직렬화. → 이 인시던트의 직접 재발방지.
2. **[운영·최우선] provider 방화벽/도달성 장애 해소** — 이 rc=255 가 근본. belie 가 provider 에서 GH Actions IP→VPS:22 도달성 점검. detached 로 사이트다운은 막았지만, 도달성 장애가 남으면 배포가 러너상 빨강(재확인 필요)으로 뜨는 성가심은 지속.
3. **[관측] 배포 실패 시 자동 health 확인** — 배포 failure 후 즉시 공개 health 체크 + 502 면 rerun 자동 트리거(또는 알림). 지금은 사람이 발견해야 함.

## 교훈
- 도달성 장애를 "재시도하면 되는 성가심"으로 축소하지 말 것 — **원자 배포도 연결이 실행 중간에 끊기면 깨진다.** 원격 실행은 연결 수명과 분리(detached)해야 진짜 원자적. → detached 로 반영 완료.
