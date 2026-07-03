#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

if motif_gateway_is_healthy; then
  motif_gateway_health | python3 -m json.tool 2>/dev/null || motif_gateway_health
  exit 0
fi

echo "Motif gateway is not healthy at ${MOTIF_GATEWAY_HEALTH}" >&2
if [[ -n "$(motif_gateway_pid)" ]]; then
  echo "PID $(motif_gateway_pid) is listening but /v1/health failed." >&2
else
  echo "Nothing listening on port ${MOTIF_GATEWAY_PORT}. Run: npm run server:start" >&2
fi
exit 1
