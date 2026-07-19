#!/usr/bin/env bash
# scripts/doc-drift.sh — SSOT 드리프트 검사 (Hashimoto 가드레일).
#
# 원칙:
#   "현재 코드가 진실, SSOT는 그걸 반영해야 한다."
#
# 검사 방향: 코드 → SSOT (한 방향만).
#   코드에 있는 컴포넌트/타입/시트키가 SSOT 문서에 등재되어 있는지 grep.
#   반대(SSOT에 있는데 코드에 없는 건)는 검사 안 함 — 그래야 옛 설계로 끌려가지 않음.
#
# 면제 (grandfathered):
#   docs/.ssot-grandfathered.md 의 ` - SYMBOL` 라인에 적힌 심볼은 검사 통과.
#   기존 누락분 점진 정리용. 새 PR이 추가한 누락은 면제 안 됨.
#
# 종료 코드: 0 = pass, 1 = fail
#
# 사용처:
#   - scripts/check.sh 가 자동 호출
#   - 수동: bash scripts/doc-drift.sh

set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0
miss() { echo "  ✘ MISSING: $1 (in $2)"; FAIL=1; }
ok()   { echo "  ✔ $1"; }

GRAND="docs/.ssot-grandfathered.md"
COMPONENTS_DOC="docs/design/components.md"
DATA_MODEL_DOC="docs/domains/data-model.md"
SHEET_DOC="docs/domains/sheet-structure.md"

# grandfathered 심볼 추출 (라인이 "- SYMBOL" 형태)
grandfathered_has() {
  local sym="$1"
  [ -f "$GRAND" ] && grep -qE "^- ${sym}( |$)" "$GRAND"
}

# SSOT 문서에 심볼이 등재됐는지 — 단어 경계로 grep
doc_has() {
  local doc="$1"
  local sym="$2"
  [ -f "$doc" ] || return 1
  grep -qE "(^|[^A-Za-z0-9_])${sym}([^A-Za-z0-9_]|$)" "$doc"
}

# ── 1. components/**/*.tsx → components.md ─────────────────
echo "▶ A. components/ → components.md"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  base="$(basename "$f" .tsx)"
  if doc_has "$COMPONENTS_DOC" "$base"; then
    ok "$base"
  elif grandfathered_has "$base"; then
    echo "  ⊘ $base (grandfathered)"
  else
    miss "$base" "$COMPONENTS_DOC"
  fi
done < <(find components -type f -name '*.tsx' 2>/dev/null | sort)

# ── 2. app/(app)/**/_components/*.tsx → components.md ──────
echo ""
echo "▶ B. app/(app)/_components/ → components.md"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  base="$(basename "$f" .tsx)"
  if doc_has "$COMPONENTS_DOC" "$base"; then
    ok "$base"
  elif grandfathered_has "$base"; then
    echo "  ⊘ $base (grandfathered)"
  else
    miss "$base" "$COMPONENTS_DOC"
  fi
done < <(find "app/(app)" -type f -path "*/_components/*.tsx" 2>/dev/null | sort)

# ── 3. lib/types/*.ts exports → data-model.md ──────────────
echo ""
echo "▶ C. lib/types exports → data-model.md"
# `export const X = z.` 또는 `export interface X` 매칭 (type alias는 Zod와 짝이라 제외)
# index.ts 는 배럴(export * 재수출) — 실제 정의는 도메인별 파일(channel.ts·meeting.ts·db.ts…).
# 재수출은 이 패턴에 안 걸리므로 lib/types/*.ts 전체를 grep (-h: 파일명 프리픽스 제거).
exports=$(grep -hE "^export (const [A-Z][A-Za-z0-9_]* = z\.|interface [A-Z][A-Za-z0-9_]*)" lib/types/*.ts \
  | sed -E 's/^export (const|interface) ([A-Z][A-Za-z0-9_]*).*$/\2/' \
  | sort -u)
for sym in $exports; do
  if doc_has "$DATA_MODEL_DOC" "$sym"; then
    ok "$sym"
  elif grandfathered_has "$sym"; then
    echo "  ⊘ $sym (grandfathered)"
  else
    miss "$sym" "$DATA_MODEL_DOC"
  fi
done

# ── 4. SHEET_RANGES.* keys → sheet-structure.md ────────────
echo ""
echo "▶ D. SHEET_RANGES.* keys → sheet-structure.md"
keys=$(grep -E "^  [a-zA-Z]+: \{" lib/config/index.ts \
  | sed -E 's/^  ([a-zA-Z]+):.*$/\1/' \
  | sort -u)
for k in $keys; do
  if doc_has "$SHEET_DOC" "$k"; then
    ok "$k"
  elif grandfathered_has "$k"; then
    echo "  ⊘ $k (grandfathered)"
  else
    miss "$k" "$SHEET_DOC"
  fi
done

echo ""
if [ $FAIL -eq 0 ]; then
  echo "✅ doc-drift PASSED"
  exit 0
else
  echo "❌ doc-drift FAILED"
  echo ""
  echo "  → 신규 누락이면 SSOT 문서에 등록 후 다시 시도."
  echo "  → 옛 누락분이면 docs/.ssot-grandfathered.md 에 추가 (점진 backfill 대상)."
  echo "  → 원칙: '현재 코드가 진실, SSOT가 따라간다'. 옛 설계로 끌려가지 말 것."
  exit 1
fi
