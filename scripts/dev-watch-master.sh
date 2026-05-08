#!/usr/bin/env bash
# scripts/dev-watch-master.sh
#
# 목적: dev server가 도는 worktree가 origin/master에 뒤처지지 않도록 자동 동기화.
#
# 배경:
#   사용자가 GitHub 웹에서 PR 머지 → 로컬 worktree는 옛 브랜치 그대로 →
#   브라우저 새로고침해도 옛 화면 → 사용자 불편 → 매번 수동 pull.
#   Hashimoto 원칙: 같은 실수 반복 = harness 결함. 자동화로 박는다.
#
# 동작:
#   30초마다 origin/master fetch → 로컬과 다르면 pull.
#   Next.js dev server는 파일 변경 감지해 자동 hot-reload (재시작 불필요).
#
# 사용:
#   $ npm run dev    # 이 스크립트가 자동으로 같이 켜짐 (package.json wiring)
#   또는 단독:
#   $ bash scripts/dev-watch-master.sh
#
# 수동 종료: Ctrl+C (npm run dev 종료 시 같이 종료)

set -euo pipefail
cd "$(dirname "$0")/.."

INTERVAL_SEC="${WATCH_INTERVAL_SEC:-30}"

echo "🔁 dev-watch-master 시작 (${INTERVAL_SEC}s interval)"
echo "   origin/master 변경되면 자동 pull → Next.js hot-reload."

while true; do
  # 조용히 fetch (네트워크 에러 시 무시하고 다음 라운드)
  git fetch origin master --quiet 2>/dev/null || {
    sleep "$INTERVAL_SEC"
    continue
  }

  LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "")
  REMOTE=$(git rev-parse origin/master 2>/dev/null || echo "")

  if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    SHORT=$(git rev-parse --short origin/master)
    echo ""
    echo "🔄 origin/master 갱신 감지 ($SHORT) — pull 중..."

    # 워킹 디렉토리에 변경사항 있으면 충돌 위험 — stash 후 복원 시도
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo "   ⚠ 작업 중 변경사항 있음 — stash 후 진행"
      git stash push -u -m "dev-watch auto-stash $(date +%s)" >/dev/null 2>&1 || true
      STASHED=1
    else
      STASHED=0
    fi

    if git pull origin master --ff-only --quiet 2>/dev/null; then
      NEW_HEAD=$(git rev-parse --short HEAD)
      echo "   ✅ $NEW_HEAD 으로 업데이트. Next.js 가 자동 hot-reload."
    else
      echo "   ✘ pull 실패 (fast-forward 불가). 수동 처리 필요."
    fi

    if [ "$STASHED" = "1" ]; then
      git stash pop >/dev/null 2>&1 && echo "   ↻ stash 복원" || echo "   ⚠ stash 복원 실패. git stash list 확인"
    fi
  fi

  sleep "$INTERVAL_SEC"
done
