#!/usr/bin/env bash
# scripts/dev-with-watch.sh
#
# Next.js dev server + master 자동 sync watcher 동시 실행.
# Hashimoto 가드 — dev server worktree가 origin/master 뒤처지지 않게.
#
# - Ctrl+C 한 번에 둘 다 종료.
# - watcher가 죽어도 dev server는 계속 (degraded but functional).

set -uo pipefail
cd "$(dirname "$0")/.."

# watcher 백그라운드 실행
bash scripts/dev-watch-master.sh &
WATCHER_PID=$!

# 종료 시 watcher 정리
cleanup() {
  if kill -0 "$WATCHER_PID" 2>/dev/null; then
    kill "$WATCHER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Next.js dev (foreground — 콘솔 그대로)
exec npx --no -- next dev
