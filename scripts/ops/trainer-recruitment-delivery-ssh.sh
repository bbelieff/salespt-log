#!/usr/bin/env bash
# Protected transport only. Inputs were checked before SSH; recheck at command boundary.
set -euo pipefail
[[ "$EXPECTED_SHA" =~ ^[a-f0-9]{40}$ && "$GITHUB_SHA" == "$EXPECTED_SHA" ]]
[[ "$EXPECTED_SQL_SHA256" =~ ^[a-f0-9]{64}$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[1-9][0-9]*$ && "$GITHUB_RUN_ATTEMPT" =~ ^[1-9][0-9]*$ ]]
[[ "$EXECUTE" == true || "$EXECUTE" == false ]]
[[ "${REPAIR_HISTORY_ACL:-false}" == false ]]
[[ "${COMPARE_RUNTIME:-false}" == true || "${COMPARE_RUNTIME:-false}" == false ]]
[[ "${REPAIR_HISTORY_ACL:-false}" != true || "$EXECUTE" == false ]]
[[ "$EXECUTE" != true && "${REPAIR_HISTORY_ACL:-false}" != true || "${COMPARE_RUNTIME:-false}" == true ]]
STAGE="/opt/salespt-migrations/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$EXPECTED_SHA"
ARCHIVE="$RUNNER_TEMP/trainer-payload.tar"
ARCHIVE_HASH=$(sha256sum "$ARCHIVE" | cut -d' ' -f1)
MANIFEST_HASH=$(sha256sum "$RUNNER_TEMP/trainer-payload/manifest.json" | cut -d' ' -f1)
[[ "$ARCHIVE_HASH" =~ ^[a-f0-9]{64}$ && "$MANIFEST_HASH" =~ ^[a-f0-9]{64}$ ]]
HOSTS=("$VPS_TARGET_HOST")
if [[ "$VPS_FALLBACK_HOST" != "$VPS_TARGET_HOST" ]]; then HOSTS+=("$VPS_FALLBACK_HOST"); fi
if [[ -n "${VPS_HOST_V6:-}" ]]; then HOSTS+=("$VPS_HOST_V6"); fi
ssh_retry() {
  local command="$1" input="${2:-/dev/null}" rc host family target i
  for i in $(seq 1 15); do
    host="${HOSTS[$(( (i - 1) % ${#HOSTS[@]} ))]}"
    if [[ "$host" == *:* ]]; then family=-6; target="root@[$host]"; else family=-4; target="root@$host"; fi
    rc=0
    ssh "$family" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 \
      -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -i "$HOME/.ssh/id_ed25519" \
      "$target" "$command" < "$input" || rc=$?
    [[ "$rc" != 255 ]] && return "$rc"
    echo "Transport interrupted (255); bounded retry $i/15, no application retry for other codes" >&2
    [[ "$i" == 15 ]] || sleep 25
  done
  return 255
}
# Each boundary rejects redirected ancestors before creating/writing any stage file.
GUARD="test ! -L /opt; test \"\$(realpath /opt)\" = /opt
  test ! -L /opt/salespt-migrations
  mkdir -p /opt/salespt-migrations
  test \"\$(realpath /opt/salespt-migrations)\" = /opt/salespt-migrations
  test ! -L '$STAGE'; mkdir -p '$STAGE'; test \"\$(realpath '$STAGE')\" = '$STAGE'
  test ! -L '$STAGE/payload.tar.partial'; test ! -L '$STAGE/ARTIFACT_READY'
  test ! -L '$STAGE/payload'; test ! -L '$STAGE/preflight-result.json'; test ! -L '$STAGE/execute-result.json'
  test ! -L '$STAGE/repair-history-acl-result.json'; test ! -L '$STAGE/compare-runtime-result.json'"
# Do not overwrite a fully verified stage on a transport retry; consume stdin safely.
ssh_retry "set -eu; umask 077; $GUARD
  if test -f '$STAGE/ARTIFACT_READY'; then
    test \"\$(cat '$STAGE/ARTIFACT_READY')\" = '$MANIFEST_HASH'; cat > /dev/null
  else cat > '$STAGE/payload.tar.partial'; fi" "$ARCHIVE"
ssh_retry "set -eu; umask 077
  $GUARD
  test \"\$(sha256sum '$STAGE/payload.tar.partial' | cut -d' ' -f1)\" = '$ARCHIVE_HASH'
  mkdir -p '$STAGE/payload'; test \"\$(realpath '$STAGE/payload')\" = '$STAGE/payload'
  if ! test -f '$STAGE/ARTIFACT_READY'; then
    test -z \"\$(find '$STAGE/payload' -type l -print -quit)\"
    tar --no-same-owner --no-same-permissions -xf '$STAGE/payload.tar.partial' -C '$STAGE/payload'
  fi
  node '$STAGE/payload/scripts/ops/trainer-recruitment-delivery-run.mjs' verify '$EXPECTED_SHA' '$MANIFEST_HASH' '$EXPECTED_SQL_SHA256'
  printf '%s\n' '$MANIFEST_HASH' > '$STAGE/ARTIFACT_READY'
"
RUNNER="node '$STAGE/payload/scripts/ops/trainer-recruitment-delivery-run.mjs'"
ARGS="'$EXPECTED_SHA' '$MANIFEST_HASH' '$EXPECTED_SQL_SHA256'"
# Bounded DB transaction is safe on interruption. A transport retry revalidates and is exact-only/no-op.
if [[ "${COMPARE_RUNTIME:-false}" == true ]]; then
  ssh_retry "set -eu; $GUARD; cd /opt/salespt-log; $RUNNER compare-runtime $ARGS"
fi
ssh_retry "set -eu; $GUARD; cd /opt/salespt-log; $RUNNER preflight $ARGS"
if [[ "$EXECUTE" == true ]]; then
  ssh_retry "set -eu; $GUARD; cd /opt/salespt-log; $RUNNER execute $ARGS"
  ssh_retry "set -eu; $GUARD; cd /opt/salespt-log; $RUNNER preflight $ARGS"
  ssh_retry "set -eu; $GUARD; cd /opt/salespt-log; $RUNNER compare-runtime $ARGS"
fi
printf 'Artifact SHA256=%s manifest SHA256=%s stage=%s\n' "$ARCHIVE_HASH" "$MANIFEST_HASH" "$STAGE"
