#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log()  { echo "[dev-up] $*"; }
fail() { echo "[dev-up] ERROR: $*" >&2; exit 1; }

wait_http() {
  local name="$1" url="$2"
  log "Waiting for ${name}..."
  until curl -sf "$url" >/dev/null 2>&1; do sleep 2; done
  log "${name} ready."
}

wait_redis() {
  log "Waiting for Redis..."
  until docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do sleep 1; done
  log "Redis ready."
}

# ── preflight ──────────────────────────────────────────────────────────────────
[[ -f ".env.local" ]] || fail ".env.local not found. Run: cp .env.local.example .env.local"
# shellcheck disable=SC1091
set -a && source ".env.local" && set +a

# ── infrastructure ─────────────────────────────────────────────────────────────
log "Starting Docker (Twenty + Redis)..."
docker compose up -d

log "Starting Supabase..."
supabase start

# ── wait for healthy ───────────────────────────────────────────────────────────
wait_redis
wait_http "Twenty" "${TWENTY_PUBLIC_URL:-http://localhost:3000}/healthz"

# ── app services ───────────────────────────────────────────────────────────────
log "All services up. Starting API (port ${APP_PORT:-3011}) and Worker..."
log "Zalo connector: run 'pnpm zalo:listen' in a separate terminal when needed."
log "Press Ctrl+C to stop."
echo ""

_cleanup() {
  echo ""
  log "Stopping API and Worker..."
  kill "${API_PID:-}" "${WORKER_PID:-}" 2>/dev/null || true
  wait "${API_PID:-}" "${WORKER_PID:-}" 2>/dev/null || true
  log "Done. Run 'pnpm dev:down' to also stop Docker + Supabase."
}
trap _cleanup INT TERM

pnpm --filter @platform/api dev &
API_PID=$!

pnpm --filter @platform/worker dev &
WORKER_PID=$!

wait "${API_PID}" "${WORKER_PID}"
