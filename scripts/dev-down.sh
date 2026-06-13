#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[dev-down] $*"; }

log "Stopping Docker services (Twenty + Redis)..."
docker compose down || true

log "Done."
