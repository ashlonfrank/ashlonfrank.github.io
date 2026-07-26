#!/usr/bin/env bash
# Push main + v2 to GitHub. Usage:
#   ./scripts/push-to-github.sh https://github.com/USERNAME/REPO.git
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/push-to-github.sh https://github.com/YOUR_USERNAME/YOUR_REPO.git"
  echo ""
  echo "Current remote:"
  git remote -v 2>/dev/null || echo "(none)"
  echo ""
  echo "Current branch: $(git branch --show-current 2>/dev/null || echo unknown)"
  exit 1
fi

REPO_URL="$1"
REPO_URL="${REPO_URL%.git}.git"

if [[ "$REPO_URL" == *"YOUR_"* ]] || [[ "$REPO_URL" == *"USERNAME"* ]]; then
  echo "Error: replace the placeholder with your real GitHub repo URL."
  exit 1
fi

if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "Remote set to: $(git remote get-url origin)"
echo "Pushing main..."
git push -u origin main
echo "Pushing v2..."
git push -u origin v2

echo ""
echo "Done. Branches on GitHub:"
echo "  main — saved copy"
echo "  v2   — experiments (current: $(git branch --show-current))"
