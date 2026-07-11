#!/usr/bin/env bash
set -euo pipefail

PORT=8765
URL="http://127.0.0.1:${PORT}/"
ENCODED_URL="$(python3 -c "import urllib.parse; print(urllib.parse.quote('$URL', safe=''))")"

CURSOR_BIN="${CURSOR_BIN:-}"
if [[ -z "$CURSOR_BIN" ]]; then
  for candidate in \
    "${CURSOR_BIN:-}" \
    "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" \
    "$(command -v cursor 2>/dev/null || true)"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      CURSOR_BIN="$candidate"
      break
    fi
  done
fi

if [[ -n "$CURSOR_BIN" ]]; then
  "$CURSOR_BIN" --open-url "vscode://vscode/simple-browser?url=${ENCODED_URL}"
  echo "Opened preview in Cursor at ${URL}"
else
  echo "Cursor CLI not found. Open Simple Browser manually: ${URL}" >&2
  open "$URL"
fi
