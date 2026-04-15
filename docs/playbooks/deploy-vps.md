# Playbook — 자체 VPS 배포 (Caddy + Docker Compose)

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
