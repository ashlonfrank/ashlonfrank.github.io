#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! curl -sf -o /dev/null "http://127.0.0.1:8765/" 2>/dev/null; then
  echo "Starting preview server..."
  "$ROOT/scripts/start-preview-server.sh" &
  for _ in $(seq 1 50); do
    curl -sf -o /dev/null "http://127.0.0.1:8765/" 2>/dev/null && break
    sleep 0.1
  done
fi

"$ROOT/scripts/open-preview-in-cursor.sh"
