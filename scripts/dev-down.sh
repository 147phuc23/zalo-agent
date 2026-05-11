#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[dev-down] stopping Twenty (Docker)..."
docker compose down || true

echo "[dev-down] stopping Supabase..."
supabase stop || true
