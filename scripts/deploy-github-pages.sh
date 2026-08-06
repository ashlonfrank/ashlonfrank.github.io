#!/usr/bin/env bash
# Deploy this site to GitHub Pages at https://ashlonfrank.github.io
#
# Prerequisite: create an empty public repo named exactly:
#   https://github.com/ashlonfrank/ashlonfrank.github.io
#
# Usage (from repo root):
#   ./scripts/deploy-github-pages.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PAGES_URL="https://github.com/ashlonfrank/ashlonfrank.github.io.git"
SOURCE_BRANCH="$(git branch --show-current)"

if [[ "$SOURCE_BRANCH" != "vercel-baseline" ]]; then
  echo "Warning: production content usually lives on vercel-baseline (currently: $SOURCE_BRANCH)."
fi

if ! git remote get-url pages &>/dev/null; then
  git remote add pages "$PAGES_URL"
else
  git remote set-url pages "$PAGES_URL"
fi

echo "Pushing $SOURCE_BRANCH → pages/main ..."
if git push pages "${SOURCE_BRANCH}:main" --force-with-lease; then
  echo ""
  echo "Done. GitHub Pages will publish at:"
  echo "  https://ashlonfrank.github.io"
  echo ""
  echo "If this is the first push, enable Pages in repo Settings → Pages →"
  echo "  Source: Deploy from branch → main → / (root)"
else
  echo ""
  echo "Push failed. If the repo does not exist yet:"
  echo "  1. https://github.com/new → name it ashlonfrank.github.io (public, no README)"
  echo "  2. Re-run: ./scripts/deploy-github-pages.sh"
  exit 1
fi
