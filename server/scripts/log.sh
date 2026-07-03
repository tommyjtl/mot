#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="${ROOT}/logs/gateway.log"
LINES="${1:-50}"

# shellcheck source=common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

if [[ ! -f "${LOG_FILE}" ]]; then
  echo "No log file yet: ${LOG_FILE}"
  if [[ -n "$(motif_gateway_pid)" ]]; then
    echo "Gateway is running (PID $(motif_gateway_pid)) but was started before logging was enabled."
    echo "Run: npm run server:restart"
  else
    echo "Start the gateway with: npm run server:start"
  fi
  exit 1
fi

if [[ "${1:-}" == "-f" || "${1:-}" == "--follow" ]]; then
  tail -f "${LOG_FILE}"
else
  tail -n "${LINES}" "${LOG_FILE}"
fi
