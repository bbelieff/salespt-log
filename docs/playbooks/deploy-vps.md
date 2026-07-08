# Playbook — 자체 VPS 배포 & 롤백

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 현행 배포(PM2 + GitHub Actions 자동) 절차와 **롤백** 정본. CLAUDE.md §6.8 의 상세판.
> - **누가 읽나요**: 개발자, 에이전트
> - **관련 문서**: `CLAUDE.md §6.8`, `.github/workflows/deploy.yml`

---

## 0. 현행 운영 (정본) — PM2 + GitHub Actions

> ⚠️ 아래 §1~9 의 **Docker Compose/`/srv/salespt`** 설명은 **legacy 참고용**. 실제 운영은
> **PM2 + `/opt/salespt-log` + GitHub Actions(`deploy.yml`)** 이다. 충돌 시 이 §0 이 정본.

**스택**: VPS `/opt/salespt-log` · Next.js standalone(`npm run build`) · **PM2**(`salespt-log`) · Caddy 리버스프록시(자동 HTTPS) · 공개 `https://salesptlog.online`.

**배포(자동)**: `master` push → `.github/workflows/deploy.yml` 자동 실행. 수동 = `gh workflow run "Deploy to VPS"`.
워크플로우: `git reset --hard origin/master` → `npm ci` → `rm -rf .next && npm run build`(`NODE_OPTIONS=--max-old-space-size=2048`, **BUILD_ID 검증**) → `pm2 restart salespt-log --update-env` → `pm2 save` → health(`:3000` + `https://salesptlog.online`).
- RAM 3.8GB VPS — 빌드 메모리 **2048MB** 고정(4096 시 OOM-killer → silent 옛빌드 잔존 사고, 2026-05-13).
- **빌드 캐시(2026-07-08 chore/deploy-build-cache)**: `npm ci` 는 package-lock.json
  sha256 이 마커(`.npm-ci.hash`, VPS untracked)와 같으면 **스킵**, 직전 릴리스의
  `.next/cache` 는 `.next-build/cache` 로 복사(cp -al 하드링크 우선)해 재활용.
  **빌드가 이상하면(캐시 오염 의심) `gh workflow run "Deploy to VPS" -f clean=true` 1회**
  — 마커 무시+캐시 미복사로 완전 클린 빌드. 무중단·롤백 경로 영향 없음(런타임은
  cache 디렉토리 미사용).
- **SSH 접속(2026-06-04 개선)**: `ssh-keyscan` 은 best-effort(`|| true`) — 하드 게이트 아님. 실제 ssh 는 `StrictHostKeyChecking=accept-new`(TOFU) + `ConnectTimeout=30` 으로 known_hosts 없이도 접속. 러너↔VPS 22번의 **간헐적 연결 타임아웃**은 Deploy 단계가 **연결 실패(ssh rc=255)에 한해 최대 7회×30s(~7분 창) 재시도**로 흡수(2026-07-07 run#426: 5회×15s 창을 넘는 4~5분대 장애 실측 → 확대. 빌드/원격 실패=다른 rc 는 즉시 fail → 롤백 신호). 주입 스텝도 rc=255 시 1회 재시도. 과거: keyscan 을 하드 게이트로 둬서 간헐 타임아웃에 배포 전체가 막히던 오진 유발(sshd 는 정상이었음).

**Secret 추가 절차 (운영자용 — SSH 불필요, 2026-07-06 도입)**: 배포 파이프라인이
GitHub Secrets 의 `DATABASE_URL` 을 VPS `/opt/salespt-log/.env` 에 자동 주입한다
(deploy.yml "Inject DATABASE_URL" 스텝 — 멱등: 해당 키 한 줄만 교체/추가, 다른 줄 비파괴,
값은 stdin→원격 600 파일로만 이동해 **로그에 절대 안 찍힘**). 등록 방법: GitHub 레포 →
**Settings → Secrets and variables → Actions → New repository secret** → Name `DATABASE_URL`,
Value 에 접속 문자열 입력 → 다음 배포부터 자동 반영. secret 미설정이면 스텝은 조용히 스킵,
주입 실패는 경고만 남기고 배포는 계속(파일럿 dual-write 비차단 원칙, db-migration-pilot §3).

**머지 후 에이전트 절차** (CLAUDE.md §6.8):
1. 머지 직전 `git rev-parse origin/master` 로 **last-good SHA** 기록.
2. 배포 run 관찰: `gh run list --workflow="Deploy to VPS" -L1` → `gh run view <id> --json conclusion,status`.
3. **success 판정은 반드시 `--json conclusion` 의 "success" 문자열로** — 무중단 설계상 **사이트 200 은 성공 증거가 아니다**(빨간 run 이어도 옛/이전 attempt 릴리스가 200 으로 서빙됨 — 2026-07-07 오보고 사고, incidents/2026-07-07-deploy-426-vps-unreachable.md). success 확인 후 `curl -I`(200)는 "다운 아님" 보조 확인. / **연결 실패(ssh rc=255)** → 7회×30s 자동 재시도 내장(⚠️ GH 기본 `bash -e` 때문에 `|| rc=$?` 로 포착해야 재시도가 작동 — 2026-06-04 수정). 그래도 실패면 러너↔VPS 22번 간헐 장애 지속 → `gh run rerun <id> --failed`(다른 러너 IP/시간대로 보통 성공) + 네트워크/제공사 edge 의심(sshd active·다른 run 접속됨이면 OS 손질 불필요). / **build·health 실패(다른 rc)** → 즉시 롤백.

**롤백 (정본 — force-push 금지)**:
```bash
# 이 레포 PR = --squash → master 에 단일 커밋. 그 커밋만 되돌림(머지커밋 아님 → -m 불필요).
git revert <bad-squash-sha>
git push origin master          # → 자동 재배포(직전 정상 코드)
# 확인: gh run view <new-id> --json conclusion  + curl -I https://salesptlog.online
```
- 절대 `git reset --hard` + `push --force` 로 master 역사 훼손 금지.
- 롤백 후 원인분석 → fix-forward PR. 실패·롤백은 `docs/incidents/` 기록.

---

## (Legacy 참고) Caddy + Docker Compose 초기 셋업

**목표**: Next.js 앱을 VPS 에 올리고 자체 도메인으로 자동 HTTPS 제공.
**전제**: Ubuntu/Debian 계열 VPS, 포트 80/443 오픈, 도메인 1개 보유.

## 1. 도메인 DNS
1. 도메인 등록 (가비아, Namecheap, Cloudflare Registrar 등).
2. A 레코드 생성: `app.example.com → <VPS 공인 IP>`
3. Cloudflare 사용 시 **Proxy 끄고 (DNS only)** 두는 편이 Caddy 의 자동 HTTPS 와 궁합이 좋음 (ACME HTTP-01 통과).

## 2. VPS 준비
```bash
ssh root@<vps-ip>
apt update && apt -y upgrade
apt -y install docker.io docker-compose-plugin git
systemctl enable --now docker
```

## 3. 레포 배치
```bash
mkdir -p /srv/salespt && cd /srv/salespt
git clone <repo-url> .
# 또는: git pull 로 업데이트
```

## 4. 프로덕션 환경변수
`/srv/salespt/.env.production` 을 아래 형식으로. **커밋 금지**.
```
DOMAIN=app.example.com
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://app.example.com
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SHEETS_REGISTRY_ID=...
SHEETS_REGISTRY_TAB=users
```

Google Cloud Console 에서 OAuth 리디렉션 URI 에 `https://app.example.com/api/auth/callback/google` 추가하는 것을 **잊지 말 것** (안 하면 로그인 시 400).

## 5. 빌드 & 기동
```bash
cd /srv/salespt
docker compose build
docker compose up -d
docker compose logs -f caddy   # 인증서 발급 확인
```

Caddy 가 Let's Encrypt 인증서를 자동 발급한다 (1분 내외).

## 6. 헬스 체크
```bash
curl -I https://app.example.com
# HTTP/2 200
```

## 7. 배포 업데이트 루틴
```bash
cd /srv/salespt
git pull
docker compose build app
docker compose up -d app
```

롤백:
```bash
git checkout <prev-commit>
docker compose build app && docker compose up -d app
```

## 8. 백업 (Sheets 가 SSOT 이지만)
- `/srv/salespt/.env.production` → 암호화 후 별도 저장.
- Caddy volume (`caddy_data`) — 인증서 보관용. 재발급 가능하지만 rate limit 있음.
- 서비스 계정 JSON 원본 — **VPS 바깥** 안전한 곳에.

## 9. 흔한 오류
- **ACME 실패**: 80 포트 막힘 → 방화벽(`ufw allow 80,443/tcp`).
- **OAuth redirect_uri_mismatch**: GCP 콘솔의 리디렉션 URI 누락.
- **Sheets 403**: 서비스 계정이 대상 시트에 공유되지 않음.
- **standalone not found**: `next.config.mjs` 에 `output: "standalone"` 누락.
