# VPS 배포·실패 대응

> **요약**: 현재 PM2 운영의 배포·확인·복구 절차.
> **관련**: [CLAUDE §6.8](../../CLAUDE.md), [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml), [ecosystem.config.cjs](../../ecosystem.config.cjs).

## 현행 운영
- 공개 https://salesptlog.online, VPS /opt/salespt-log, PM2 salespt-log, Caddy.
- master push → Deploy to VPS. 수동은 gh workflow run "Deploy to VPS".
- 구현 정본은 deploy.yml: 원격 Git 동기화 → lock hash 기준 npm ci → .next-build 빌드 → BUILD_ID 검증 → 원자 swap → PM2 reload → 내부/공개 health.
- 원격은 setsid로 분리 실행하고 flock으로 직렬화한다. .deploy/<run>.status·로그로 완료를 판정한다. 러너 연결 끊김과 원격 실패는 다르다.
- 빌드 힙 2048MB. 다른 서비스 종료나 힙 상향으로 우회하지 않는다.
- 모아워크 /srv/moawork-direct·:3100 및 다른 운영 서비스 접근/수정/종료 금지. 배포 외 수동 운영 조작은 요청된 범위를 확인한다.

## 정상 완료
1. 병합 직전 최신 origin/master의 last-good SHA 기록.
2. 현재 PR head의 check.sh·필요한 build·CI 확인, 직렬 순서로 squash.
3. 해당 병합 SHA의 배포 run을 끝까지 확인: gh run view <id> --json conclusion,status,headSha.
4. conclusion=success와 공개 health HTTP 200 확인, 안전한 실제 기능 검증.
5. SHA·run·검사·live 확인·미완료를 worklog/PR에 기록. 200만으로 새 버전 성공을 주장하지 않는다.

## 실패 분류
- SSH/러너 접속 실패: 원격 .deploy 상태와 도달성을 확인한다. 원격이 계속 실행 중이면 중복 배포를 띄우지 않는다. 완료 상태를 확인하거나 gh run rerun <id> --failed로 재확인한다. 접속 실패만으로 코드 revert하지 않는다.
- heap OOM: 같은 커밋을 1회 rerun하고 결과 확인. 반복 실패는 로그·build_peak_rss_kb·빌드 전 메모리로 원인을 좁힌다. 반복 rerun이나 힙 상향을 자동 실행하지 않는다.
- build/BUILD_ID 실패: 기존 릴리스가 유지됐는지 확인한다. 실제 코드 결함이면 fix-forward 또는 정상 커밋으로 revert한다.
- swap 후 health 실패: 원격 자동 롤백과 로그를 확인한다. 필요하면 실패 squash를 git revert하고 새 배포·health까지 확인한다.
- 캐시 오염 근거가 있으면 gh workflow run "Deploy to VPS" -f clean=true 1회. 일반 접속/OOM 문제를 캐시 문제로 단정하지 않는다.
- Git reset --hard + force-push로 master 역사를 변경하지 않는다. SSH를 짧은 간격으로 반복하거나 다른 서비스 설정을 고치지 않는다.
- 롤백/실패/복구 증거는 비식별 인시던트로 남긴다. 원시 환경변수·인증정보 출력 금지.

## Secret 추가 절차
- 비밀값 정본은 VPS .env이며 승인된 GitHub Secrets 주입을 통해 전달한다. 로컬·문서·커밋·로그로 복사하지 않는다.
- 운영자는 GitHub Settings → Secrets and variables → Actions에서 값을 직접 입력한다.
- 새 주입 키는 deploy.yml의 INJECT_KEYS/env 매핑을 별도 변경으로 검토한다. 값은 stdin/권한 제한 파일로만 전달하고 존재 여부만 확인한다.
- 배포가 DB migration apply를 대신하지 않는다. migration/백필은 데이터 범위·보존 가드·dry-run과 기존 승인 범위를 확인한다. 새 비가역 데이터 변경·권한 등 범위가 달라질 때만 추가 확인한다.

## 설정·자원
- PM2 설정 정본은 ecosystem.config.cjs. 설정 변경은 reload만으로 충분한지 확인하고 필요한 운영 적용을 별도 범위로 검증한다.
- 현재 빌드·캐시·상태파일 경로는 deploy.yml을 확인한다. 옛 Docker Compose·/srv/salespt 초기 설정을 현재 운영 명령으로 실행하지 않는다.
