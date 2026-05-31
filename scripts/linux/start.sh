#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
HOST_ADDRESS="${HOST_ADDRESS:-0.0.0.0}"
SKIP_INSTALL=0
SKIP_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    --host)
      HOST_ADDRESS="$2"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./start-linux.sh [--port 3000] [--host 0.0.0.0] [--skip-install] [--skip-build]
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
RUNNER_FILE="$RUN_DIR/run-backend.sh"
STDOUT_LOG="$RUN_DIR/twice-discography.out.log"
STDERR_LOG="$RUN_DIR/twice-discography.err.log"

ensure_command() {
  local name="$1"
  local hint="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "$name is not installed or not available in PATH. $hint" >&2
    exit 1
  fi
}

port_available() {
  if command -v ss >/dev/null 2>&1; then
    ! ss -ltn "( sport = :$PORT )" | tail -n +2 | grep -q .
  elif command -v lsof >/dev/null 2>&1; then
    ! lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1
  elif command -v netstat >/dev/null 2>&1; then
    ! netstat -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$PORT$"
  else
    return 0
  fi
}

cd "$ROOT_DIR"
mkdir -p "$RUN_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(head -n 1 "$PID_FILE" || true)"
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" >/dev/null 2>&1; then
    echo "TWICE Discography is already running. PID: $EXISTING_PID"
    echo "Local URL: http://127.0.0.1:$PORT"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if ! port_available; then
  echo "Port $PORT is already in use. Run ./stop-linux.sh first, or pass another --port." >&2
  exit 1
fi

ensure_command "node" "Install Node.js 20+ first."

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9.7.0 --activate
  fi
fi

ensure_command "pnpm" "Run first: corepack enable && corepack prepare pnpm@9.7.0 --activate"

if [[ ! -f ".env" && -f ".env.example" ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Adjust domain/port settings if needed."
fi

if [[ "$SKIP_INSTALL" -eq 0 && ! -d "node_modules" ]]; then
  echo "Installing dependencies..."
  pnpm install --frozen-lockfile
fi

export NODE_ENV=production
export BACKEND_PORT="$PORT"
export BACKEND_HOST="$HOST_ADDRESS"
export VITE_API_BASE="/api"
export VITE_STATIC_BASE="/static"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "Building frontend and backend..."
  pnpm build
fi

cat > "$RUNNER_FILE" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$ROOT_DIR"
export NODE_ENV=production
export BACKEND_PORT="$PORT"
export BACKEND_HOST="$HOST_ADDRESS"
export VITE_API_BASE="/api"
export VITE_STATIC_BASE="/static"
exec pnpm --filter backend start
EOF
chmod +x "$RUNNER_FILE"

if command -v setsid >/dev/null 2>&1; then
  setsid "$RUNNER_FILE" >"$STDOUT_LOG" 2>"$STDERR_LOG" &
else
  "$RUNNER_FILE" >"$STDOUT_LOG" 2>"$STDERR_LOG" &
fi

APP_PID="$!"
echo "$APP_PID" > "$PID_FILE"

HEALTH_URL="http://127.0.0.1:$PORT/health"
HEALTHY=0
for _ in $(seq 1 20); do
  sleep 0.5
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    echo "Service failed to start. Check log: $STDERR_LOG" >&2
    exit 1
  fi

  if command -v curl >/dev/null 2>&1 && curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
done

echo "TWICE Discography started."
echo "PID: $APP_PID"
echo "Local URL: http://127.0.0.1:$PORT"
echo "Log: $STDOUT_LOG"

if [[ "$HEALTHY" -ne 1 ]]; then
  echo "Warning: process started, but health check did not pass yet. Try $HEALTH_URL later, or check $STDERR_LOG." >&2
fi
