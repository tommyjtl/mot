#!/usr/bin/env bash

MOTIF_GATEWAY_HOST="${MOTIF_GATEWAY_HOST:-127.0.0.1}"
MOTIF_GATEWAY_PORT="${MOTIF_GATEWAY_PORT:-8787}"
MOTIF_GATEWAY_URL="http://${MOTIF_GATEWAY_HOST}:${MOTIF_GATEWAY_PORT}"
MOTIF_GATEWAY_HEALTH="${MOTIF_GATEWAY_URL}/v1/health"

motif_gateway_pid() {
  lsof -t -iTCP:"${MOTIF_GATEWAY_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1
}

motif_gateway_health() {
  curl -sS -m 5 "${MOTIF_GATEWAY_HEALTH}" 2>/dev/null
}

motif_gateway_is_healthy() {
  local body
  body="$(motif_gateway_health)" || return 1
  [[ "${body}" == *'"status":"ok"'* ]] || [[ "${body}" == *'"status": "ok"'* ]]
}

motif_gateway_stop() {
  local pid
  pid="$(motif_gateway_pid)"
  if [[ -z "${pid}" ]]; then
    echo "Motif gateway is not running on ${MOTIF_GATEWAY_URL}."
    return 0
  fi

  echo "Stopping Motif gateway (pid ${pid}) on ${MOTIF_GATEWAY_URL}..."
  kill "${pid}"
  sleep 0.5

  if [[ -n "$(motif_gateway_pid)" ]]; then
    echo "Process still running; sending SIGKILL..."
    kill -9 "$(motif_gateway_pid)" 2>/dev/null || true
  fi

  echo "Stopped."
}
