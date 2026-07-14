#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Jolt Pickleball Club — deploy script
#
# NOTE: this ships the static marketing/shop pages only (dist/). The Book a
# Court page needs the Express + SQLite + Stripe server in server/ running
# somewhere — a static host (Netlify, GitHub Pages, S3, etc.) can't run that.
# For a full deploy with working bookings, host server/index.js on a real
# Node platform (Render, Railway, Fly.io, a VPS) instead — see README.md.
#
# Always builds fresh into dist/ first, then pushes that folder using
# whichever target you choose below. Only one TARGET is needed — pick
# the one that matches your hosting, or copy the pattern for another host.
# ---------------------------------------------------------------------------
set -euo pipefail

echo "▲ Building site..."
npm run build

DIST="dist"
TARGET="${1:-}"

usage() {
  echo ""
  echo "Usage: ./deploy.sh <target>"
  echo ""
  echo "  ./deploy.sh netlify     Deploy dist/ with the Netlify CLI"
  echo "  ./deploy.sh vercel      Deploy dist/ with the Vercel CLI"
  echo "  ./deploy.sh gh-pages    Publish dist/ to the gh-pages branch"
  echo "  ./deploy.sh rsync       rsync dist/ to a remote server (edit REMOTE below)"
  echo "  ./deploy.sh zip         Just zip dist/ for manual upload"
  echo ""
}

case "$TARGET" in
  netlify)
    npx --yes netlify-cli deploy --dir="$DIST" --prod
    ;;
  vercel)
    npx --yes vercel "$DIST" --prod
    ;;
  gh-pages)
    npx --yes gh-pages -d "$DIST"
    ;;
  rsync)
    # Edit REMOTE to your user@host:/path before using this target
    REMOTE="user@example.com:/var/www/joltpickleball"
    rsync -avz --delete "$DIST"/ "$REMOTE"
    ;;
  zip)
    OUT="jolt-site-$(date +%Y%m%d%H%M%S).zip"
    (cd "$DIST" && zip -r "../$OUT" .)
    echo "▲ Created $OUT — upload its contents to any static host."
    ;;
  *)
    usage
    exit 1
    ;;
esac

echo "▲ Deploy step '$TARGET' finished."
