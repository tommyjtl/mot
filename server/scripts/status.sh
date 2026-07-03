#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

LOG_FILE="${ROOT}/logs/gateway.log"
PID="$(motif_gateway_pid)"

echo "URL:  ${MOTIF_GATEWAY_URL}"
echo "PID:  ${PID:-not running}"
echo "Log:  ${LOG_FILE}"

if motif_gateway_is_healthy; then
  echo "Health: ok"
  motif_gateway_health | python3 -m json.tool 2>/dev/null || motif_gateway_health
  exit 0
fi

echo "Health: unavailable"
exit 1
