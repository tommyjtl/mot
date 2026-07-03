#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

LOG_DIR="${ROOT}/logs"
LOG_FILE="${LOG_DIR}/gateway.log"

if motif_gateway_is_healthy; then
  echo "Motif gateway already running on ${MOTIF_GATEWAY_URL}"
  echo "PID: $(motif_gateway_pid)"
  echo "Log: ${LOG_FILE}"
  echo "Use: npm run server:stop && npm run server:start to restart"
  exit 0
fi

if [[ -n "$(motif_gateway_pid)" ]]; then
  echo "Port ${MOTIF_GATEWAY_PORT} is in use but health check failed. Stopping stale process..."
  motif_gateway_stop
fi

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi

source .venv/bin/activate

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

pip install -e .

mkdir -p "${LOG_DIR}"

echo "Starting Motif gateway on ${MOTIF_GATEWAY_URL}"
echo "Logging to ${LOG_FILE}"
echo "Tunnel with frpc → https://motif-cloud.tjtl.io (remotePort 7016, see docs/frp-setup.md)"
echo "Other commands: npm run server:health | server:status | server:log | server:stop"

if [[ "${1:-}" == "--daemon" || "${MOTIF_GATEWAY_DAEMON:-}" == "1" ]]; then
  {
    echo "=== Motif gateway started $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
    motif-gateway 2>&1 | tee -a "${LOG_FILE}"
  } &
  disown

  for _ in {1..30}; do
    if motif_gateway_is_healthy; then
      echo "Started in background (PID $(motif_gateway_pid))"
      exit 0
    fi
    sleep 0.2
  done

  echo "Gateway did not become healthy. Check ${LOG_FILE}" >&2
  exit 1
fi

exec motif-gateway 2>&1 | tee -a "${LOG_FILE}"
