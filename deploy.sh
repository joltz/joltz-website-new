#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Jolt Pickleball Club — deploy script
#
# NOTE: this ships the static marketing/shop pages only (dist/) for the
# targets below EXCEPT ec2-api. The Book a Court and admin pages need the
# Express + SQLite + Stripe server in server/ running somewhere — a static
# host (Netlify, GitHub Pages, S3, Amplify Hosting) can't run that.
#
# The recommended AWS path: AWS Amplify Hosting for dist/ (see amplify.yml)
# + `./deploy.sh ec2-api` to push the full app to a small EC2/Lightsail
# instance for the API. Full walkthrough in DEPLOY_AWS.md.
#
# Always builds fresh into dist/ first, then pushes that folder using
# whichever target you choose below. Only one TARGET is needed — pick
# the one that matches your hosting, or copy the pattern for another host.
#
# For rsync/ec2-api: if your EC2/Lightsail key isn't already loaded in
# ssh-agent or saved as the default identity, set SSH_KEY to its path —
# otherwise ssh silently tries your default key instead and you'll hit
# "Permission denied (publickey,...)":
#   SSH_KEY=~/.ssh/my-ec2-key.pem ./deploy.sh ec2-api
# ---------------------------------------------------------------------------
set -euo pipefail

echo "▲ Building site..."
npm run build

DIST="dist"
TARGET="${1:-}"
SSH_KEY="${SSH_KEY:-}"
SSH_OPTS=()
[ -n "$SSH_KEY" ] && SSH_OPTS=(-e "ssh -i $SSH_KEY")

usage() {
  echo ""
  echo "Usage: ./deploy.sh <target>"
  echo ""
  echo "  ./deploy.sh netlify     Deploy dist/ with the Netlify CLI"
  echo "  ./deploy.sh vercel      Deploy dist/ with the Vercel CLI"
  echo "  ./deploy.sh gh-pages    Publish dist/ to the gh-pages branch"
  echo "  ./deploy.sh rsync       rsync dist/ to a remote server (edit REMOTE below)"
  echo "  ./deploy.sh ec2-api     rsync the FULL app to an EC2/Lightsail API host"
  echo "                          (edit REMOTE below) — see DEPLOY_AWS.md"
  echo "  ./deploy.sh zip         Just zip dist/ for manual upload"
  echo ""
  echo "For AWS Amplify Hosting: connect your repo in the Amplify Console —"
  echo "it builds straight from amplify.yml, no script needed here."
  echo ""
  echo "SSH_KEY=~/.ssh/your-key.pem ./deploy.sh ec2-api   (if needed — see above)"
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
    REMOTE="user@joltz.club:/var/www/joltpickleball"
    rsync -avz --delete "${SSH_OPTS[@]}" "$DIST"/ "$REMOTE"
    ;;
  ec2-api)
    # Edit REMOTE to your EC2/Lightsail user@host:/path before using this.
    # Pushes the whole repo (server/ included), not just dist/ — this
    # target is for the API host, not a static CDN. Never overwrites the
    # remote's own server/.env or server/data.db.
    REMOTE="ec2-user@ec2-18-191-145-16.us-east-2.compute.amazonaws.com:~/jolt-pickleball-club"
    rsync -avz --delete "${SSH_OPTS[@]}" \
      --exclude node_modules --exclude dist \
      --exclude server/.env --exclude 'server/data.db*' \
      ./ "$REMOTE"/
    echo "▲ Code synced. SSH in and run: npm ci --omit=dev && sudo systemctl restart jolt"
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
