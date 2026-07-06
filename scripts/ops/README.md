> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB 파일럿(Supabase) 운영 부속 — keep-alive·pg_dump 백업·옵션 B(셀프호스트) 사용법.
> - **누가 읽나요**: 운영자(belie), 에이전트
> - **어떤 기능·작업과 연결?**: db-migration-pilot §0 대응 2건, .github/workflows/db-keepalive.yml
> - **읽고 나면 알 수 있는 것**: 일시정지 방지가 어떻게 도나, 백업은 어떻게 받나, 셀프호스트 전환은 어떻게 하나
> - **관련 문서**: docs/plans/active/db-migration-pilot.md

# scripts/ops — DB 파일럿 운영 부속

## keep-alive (자동 — 손댈 것 없음)
`.github/workflows/db-keepalive.yml` 이 **주 1회(월 12:00 KST)** `db-keepalive.mjs` 를 실행해
`SELECT 1` 을 날립니다 — Supabase 무료 티어의 "7일 무요청 일시정지" 방지.
수동 실행: GitHub → Actions → **DB Keep-alive** → Run workflow. 실행 로그의
`SELECT 1 OK (…ms)` 가 곧 DATABASE_URL(비밀번호 인코딩 포함) 유효성 증명입니다.

## 백업 (수동/크론 — 무료 티어는 자동 백업 없음)
```bash
DATABASE_URL="<Supabase Session Pooler URI>" bash scripts/ops/db-backup.sh ./backups
```
- 산출: `backups/salespt-pilot-<시각>.sql.gz`, 최근 14개 자동 보관.
- 크론 예시(VPS, 매일 04:00): `0 4 * * * cd /opt/salespt-log && DATABASE_URL=$(grep ^DATABASE_URL= .env | cut -d= -f2-) bash scripts/ops/db-backup.sh /opt/backups`
- 복구: `gunzip -c <파일> | psql "$DATABASE_URL"`

## 옵션 B — 셀프호스트 (기본 아님)
Supabase 대신 자체 VPS Postgres 가 필요해지면 `docker-compose.selfhost.yml` 참고.
전환 = compose 기동 + GitHub Secrets 의 `DATABASE_URL` 값 교체(코드 무변경 —
배포가 자동 주입, deploy-vps.md §0).
