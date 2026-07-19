#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-time setup for the Jolt Pickleball Club booking API on a fresh
# Amazon Linux 2023 EC2 or Lightsail instance. Run this AFTER the app code
# is already on the box (e.g. via `git clone`, or `./deploy.sh ec2` from
# your own machine — see deploy.sh).
#
# What this does:
#   1. Installs Node.js 20 and Nginx
#   2. Installs production dependencies (npm ci)
#   3. Installs the systemd service so the API survives reboots/crashes
#   4. Installs an Nginx reverse-proxy config (you still run certbot
#      yourself, since it needs your real domain + DNS already pointed here)
#
# What this does NOT do (deliberately, since these need real values):
#   - Create server/.env — copy server/.env.example yourself and fill it in
#     BEFORE starting the service, or it'll start unconfigured
#   - Run certbot — do that once DNS for your API subdomain points here:
#       sudo certbot --nginx -d api.yourdomain.com
#   - Open security group ports 80/443 — do that in the EC2/Lightsail console
#
# Usage: ./deploy/ec2-bootstrap.sh
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "▲ Setting up Jolt Pickleball Club API in $APP_DIR"

echo "▲ Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo dnf install -y nodejs
fi
node -v

echo "▲ Installing Nginx..."
sudo dnf install -y nginx
sudo systemctl enable nginx

echo "▲ Installing production dependencies..."
cd "$APP_DIR"
npm ci --omit=dev

if [ ! -f "$APP_DIR/server/.env" ]; then
  echo ""
  echo "⚠  server/.env does not exist yet."
  echo "   cp server/.env.example server/.env"
  echo "   then fill in STRIPE_*, ADMIN_*, ALLOWED_ORIGINS, etc. before continuing."
  echo ""
fi

echo "▲ Installing systemd service..."
sudo cp "$APP_DIR/deploy/jolt.service" /etc/systemd/system/jolt.service
sudo sed -i "s#/home/ec2-user/jolt-pickleball-club#$APP_DIR#g" /etc/systemd/system/jolt.service
sudo systemctl daemon-reload
sudo systemctl enable jolt

echo "▲ Installing Nginx reverse-proxy config (edit the domain before use)..."
sudo cp "$APP_DIR/deploy/nginx-jolt.conf.example" /etc/nginx/conf.d/jolt-api.conf
echo "  → Edit /etc/nginx/conf.d/jolt-api.conf and replace api.joltz.club with your domain."
sudo nginx -t && sudo systemctl restart nginx

cat <<'EOF'

▲ Bootstrap complete. Remaining manual steps:
  1. cp server/.env.example server/.env, then fill in real values.
  2. Point your API subdomain's DNS A record at this instance's IP.
  3. Edit /etc/nginx/conf.d/jolt-api.conf with your real domain, then:
       sudo certbot --nginx -d api.yourdomain.com
  4. npm run build   (builds dist/ locally — Amplify builds its own copy
                       for the frontend, but the API host doesn't need to
                       serve dist/ at all if the frontend lives on Amplify)
  5. sudo systemctl start jolt
  6. curl https://api.yourdomain.com/healthz   → {"ok":true}

EOF
