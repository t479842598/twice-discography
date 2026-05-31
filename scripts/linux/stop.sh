#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./stop-linux.sh [--port 3000]
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="$ROOT_DIR/.codex-run"
PID_FILE="$RUN_DIR/twice-discography.pid"
STOPPED=0

stop_pid() {
  local pid="$1"
  if [[ -z "$pid" ]]; then
    return
  fi

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return
  fi

  kill -TERM "-$pid" >/dev/null 2>&1 || kill -TERM "$pid" >/dev/null 2>&1 || true
  sleep 1

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -KILL "-$pid" >/dev/null 2>&1 || kill -KILL "$pid" >/dev/null 2>&1 || true
  fi
}

if [[ -f "$PID_FILE" ]]; then
  SAVED_PID="$(head -n 1 "$PID_FILE" || true)"
  if [[ -n "$SAVED_PID" ]]; then
    stop_pid "$SAVED_PID"
    echo "Stopped TWICE Discography. PID: $SAVED_PID"
    STOPPED=1
  fi
  rm -f "$PID_FILE"
fi

if [[ "$STOPPED" -eq 0 ]]; then
  OWNER_IDS=""
  if command -v lsof >/dev/null 2>&1; then
    OWNER_IDS="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  elif command -v fuser >/dev/null 2>&1; then
    OWNER_IDS="$(fuser "$PORT/tcp" 2>/dev/null || true)"
  fi

  for owner_id in $OWNER_IDS; do
    stop_pid "$owner_id"
    echo "Stopped process on port $PORT. PID: $owner_id"
    STOPPED=1
  done
fi

if [[ "$STOPPED" -eq 0 ]]; then
  echo "No running TWICE Discography service found."
fi
