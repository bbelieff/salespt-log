#!/usr/bin/env bash
# Supabase pg_dump 백업 (db-migration-pilot §0 대응② — 무료 티어 자동 백업 없음).
# 사용: DATABASE_URL 환경변수 설정 후 실행 (크론 등록 예시는 scripts/ops/README.md).
#   bash scripts/ops/db-backup.sh [보관디렉토리=./backups]
# ★URL·비밀번호를 echo 하지 않는다. pg_dump 필요(postgresql-client 17+ 권장).
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "db-backup: DATABASE_URL 미설정 — 중단" >&2
  exit 1
fi

DIR="${1:-./backups}"
mkdir -p "$DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/salespt-pilot-$STAMP.sql.gz"

pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$OUT"
echo "db-backup: 완료 → $OUT ($(du -h "$OUT" | cut -f1))"

# 보관 정책: 최근 14개만 유지 (파일럿 규모 — 필요 시 조정)
ls -1t "$DIR"/salespt-pilot-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
