#!/usr/bin/env bash
set -euo pipefail

PORT=8765
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="http://127.0.0.1:${PORT}/"

if curl -sf -o /dev/null "$URL" 2>/dev/null; then
  exit 0
fi

cd "$ROOT"
exec python3 -m http.server "$PORT"
