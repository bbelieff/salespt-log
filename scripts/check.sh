#!/usr/bin/env bash
# scripts/check.sh — 에이전트가 커밋/PR 전 반드시 통과해야 하는 단일 진입점.
# Node/TS 스택 전용. 우회 금지. 실패 시 하네스 자체를 고친다.

set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0
step() { echo ""; echo "▶ $1"; }
ok()   { echo "  ✔ $1"; }
bad()  { echo "  ✘ $1"; FAIL=1; }

# ── 1. 타입체크 ────────────────────────────────────────────
step "typecheck (tsc --noEmit)"
npx --no -- tsc --noEmit || bad "typecheck"

# ── 2. 린트 ────────────────────────────────────────────────
step "lint (next lint)"
npx --no -- next lint --quiet || bad "lint"

# ── 3. 구조 테스트 (레이어·Sheets 격리) ─────────────────────
step "structural tests (tests/structural/)"
npx --no -- vitest run tests/structural --reporter=basic || bad "structural"

# ── 4. 단위/통합 테스트 ────────────────────────────────────
step "unit/integration tests"
if find tests lib -name "*.test.ts" -not -path "*/structural/*" 2>/dev/null | grep -q .; then
  npx --no -- vitest run --reporter=basic --exclude "tests/structural/**" || bad "tests"
else
  ok "no non-structural tests yet"
fi

# ── 5. 파일 크기 제한 (500줄 초과 경고) ────────────────────
step "file size cap (500 lines)"
big=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ "$(wc -l < "$f" 2>/dev/null || echo 0)" -gt 500 ] && big+="  - $f
"
done < <(find lib app components -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null)
if [ -n "$big" ]; then
  bad "files over 500 lines — split them:"
  printf "%s" "$big"
else
  ok "all files ≤ 500 lines"
fi

# ── 6. 문서 드리프트 ───────────────────────────────────────
step "doc drift"
if [ -f scripts/doc-drift.sh ]; then
  bash scripts/doc-drift.sh || bad "doc drift"
else
  ok "doc-drift.sh not written yet"
fi

# ── 7. Plan 존재 여부 (경고만) ─────────────────────────────
step "active plan present"
if [ -z "$(ls -A docs/plans/active 2>/dev/null | grep -v -E '(^\.gitkeep$|^_TEMPLATE)' || true)" ]; then
  echo "  ⚠ docs/plans/active/ 가 비어 있음. 계획 없이 작업하지 말 것."
fi

echo ""

# ── 8. 워크트리 위생 (경고만 — 용량은 코드 품질이 아니다) ──
# 워크트리 안에서 돌려도 걸리도록 메인 레포 루트를 git 으로 되짚는다.
# (wt/<슬러그>/ 에는 wt/ 가 없어서, cwd 기준으로만 보면 정작 필요한 사람에게 안 뜬다)
step "worktree hygiene"
WT_CAP=12
MAIN_ROOT="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
MAIN_ROOT="${MAIN_ROOT%/.git}"
WT_DIR="${MAIN_ROOT:-.}/wt"
if [ -d "$WT_DIR" ]; then
  wt_count=$(ls -1 "$WT_DIR" 2>/dev/null | wc -l | tr -d ' ')
  nm_count=$(find "$WT_DIR" -maxdepth 2 -name node_modules -type d 2>/dev/null | wc -l | tr -d ' ')
  if [ "$wt_count" -gt "$WT_CAP" ]; then
    echo "  ⚠ 워크트리 ${wt_count}개 (권장 ≤ ${WT_CAP}) · node_modules 보유 ${nm_count}개"
    echo "    머지 끝난 것부터 정리하세요 (CLAUDE.md §6.9):"
    echo "      git worktree list                     # 등록분 확인"
    echo "      rm -rf wt/<이름>/node_modules          # 용량만 회수(npm ci 로 복구)"
    echo "      git worktree remove wt/<이름> && git worktree prune"
    echo "    근거: 2026-08-20 워크트리 82개로 하드 고갈 (BBE-254)"
  else
    ok "워크트리 ${wt_count}개 · node_modules ${nm_count}개"
  fi
else
  ok "wt/ 없음"
fi

[ $FAIL -eq 0 ] && { echo "✅ check.sh PASSED"; exit 0; } || { echo "❌ check.sh FAILED"; exit 1; }
