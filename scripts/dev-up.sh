#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env.local" ]]; then
  # shellcheck disable=SC1091
  set -a && source ".env.local" && set +a
fi

echo "[dev-up] starting Supabase (local Postgres)..."
supabase start

echo "[dev-up] applying migrations + seed..."
supabase db reset

echo "[dev-up] starting Twenty (Docker)..."
docker compose up -d

echo "[dev-up] starting API + worker (foreground)..."
echo "[dev-up] open another terminal to run the connector:"
echo "         INTERNAL_INGEST_TOKEN=\$INTERNAL_INGEST_TOKEN API_BASE_URL=http://localhost:\${APP_PORT:-3010} TENANT_ID=11111111-1111-1111-1111-111111111111 pnpm zalo:listen"

pnpm dev
