#!/usr/bin/env bash
# scripts/check.sh — 에이전트가 커밋/PR 전 반드시 통과해야 하는 단일 진입점.
# 스택을 자동 감지하여 가능한 검증만 수행한다. 우회 금지. 실패 시 하네스 자체를 고친다.

set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0
step() { echo ""; echo "▶ $1"; }
ok()   { echo "  ✔ $1"; }
bad()  { echo "  ✘ $1"; FAIL=1; }

# ── 1. 타입체크 / 린트 ────────────────────────────────────────
step "typecheck & lint"
if [ -f package.json ]; then
  if grep -q '"typecheck"' package.json; then npm run -s typecheck || bad "typecheck"; else ok "typecheck skipped (no script)"; fi
  if grep -q '"lint"'      package.json; then npm run -s lint      || bad "lint";      else ok "lint skipped (no script)"; fi
elif [ -f pyproject.toml ]; then
  command -v ruff  >/dev/null && { ruff check . || bad "ruff"; } || ok "ruff not installed"
  command -v mypy  >/dev/null && { mypy . || bad "mypy"; } || ok "mypy not installed"
else
  ok "no stack detected yet — add package.json or pyproject.toml"
fi

# ── 2. 구조 테스트 (레이어 경계) ──────────────────────────────
step "structural tests (tests/structural/)"
if [ -n "$(ls -A tests/structural 2>/dev/null | grep -v .gitkeep || true)" ]; then
  if [ -f package.json ] && grep -q '"test:structural"' package.json; then
    npm run -s test:structural || bad "structural"
  elif [ -f pyproject.toml ]; then
    python -m pytest tests/structural -q || bad "structural"
  fi
else
  ok "no structural tests yet — add some to tests/structural/"
fi

# ── 3. 단위/통합 테스트 ───────────────────────────────────────
step "unit/integration tests"
if [ -f package.json ] && grep -q '"test"' package.json; then
  npm test --silent || bad "tests"
elif [ -f pyproject.toml ]; then
  python -m pytest -q || bad "pytest"
else
  ok "no tests configured"
fi

# ── 4. 파일 크기 제한 (500줄 초과 경고) ──────────────────────
step "file size cap (500 lines)"
big=$(find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.py' \) 2>/dev/null \
      | while read f; do [ "$(wc -l < "$f")" -gt 500 ] && echo "$f"; done)
if [ -n "$big" ]; then
  bad "files over 500 lines — split them:"; echo "$big"
else
  ok "all files ≤ 500 lines"
fi

# ── 5. 문서 드리프트 ──────────────────────────────────────────
step "doc drift (docs/ references real files)"
if [ -f scripts/doc-drift.sh ]; then
  bash scripts/doc-drift.sh || bad "doc drift"
else
  ok "doc-drift.sh not written yet"
fi

# ── 6. Plan 존재 여부 ─────────────────────────────────────────
step "active plan present"
if [ -z "$(ls -A docs/plans/active 2>/dev/null | grep -v .gitkeep || true)" ]; then
  echo "  ⚠ docs/plans/active/ 가 비어 있음. 계획 없이 작업하지 말 것."
fi

echo ""
[ $FAIL -eq 0 ] && { echo "✅ check.sh PASSED"; exit 0; } || { echo "❌ check.sh FAILED"; exit 1; }
