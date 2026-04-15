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
[ $FAIL -eq 0 ] && { echo "✅ check.sh PASSED"; exit 0; } || { echo "❌ check.sh FAILED"; exit 1; }
