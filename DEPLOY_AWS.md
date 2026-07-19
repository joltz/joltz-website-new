# Deploying to AWS (Amplify + a small API host)

This app has two parts, and they deploy differently on AWS:

1. **The static site** — home, shop, contact, book, and admin pages
   (HTML/CSS/JS in `dist/`). This is what **AWS Amplify Hosting** builds
   and serves.
2. **The booking API** — Express + SQLite (`server/`), which handles
   accounts, availability, checkout, and the admin panel.

**Why not put both on Amplify?** Amplify Hosting's compute is stateless —
every deploy (and every scaling event) gets fresh, ephemeral instances with
no shared local disk. SQLite is a single file on disk with one writer; it
needs to live somewhere with a real, persistent filesystem. That rules out
Amplify compute, Lambda, and any other "serverless" AWS target for the API
— not because SQLite is unsupportable on AWS, but because it needs a
*boring, persistent server*, which is exactly what a small EC2 or Lightsail
instance is.

This intentionally avoids a subscribed database service (RDS, DynamoDB,
Aurora, DocumentDB, etc.) — the "database" here is a $0-extra SQLite file
living on the same instance as the API. The only things you pay for are
ordinary compute (EC2/Lightsail) and, optionally, S3 storage for backups —
neither of which is a database subscription.

## Architecture

```
Browser
  │
  ├──► Amplify Hosting (dist/)               https://joltz.club
  │      index.html, shop.html, book.html …
  │      fetch() calls go to API_BASE_URL ───┐
  │                                          ▼
  └──► EC2 / Lightsail instance         https://api.joltz.club
         Nginx (TLS) → Node (Express) → SQLite file on local disk
```

## Part 1 — The API host (EC2 or Lightsail)

Do this first — Amplify's build needs the API's URL as an environment
variable.

1. **Launch an instance.** A `t4g.small` (or Lightsail's cheapest plan) is
   plenty for this app. Amazon Linux 2023. Open ports 22, 80, 443 in the
   security group.
2. **Get a domain/subdomain pointed at it**, e.g. `api.joltz.club`
   → the instance's Elastic IP. (Use an Elastic IP, not the default public
   IP, so it survives a stop/start.)
3. **Copy the app to the instance** — `git clone` your repo, or from your
   own machine:
   ```bash
   rsync -avz --exclude node_modules --exclude dist --exclude server/.env \
     --exclude server/data.db ./ ec2-user@18.217.250.191 :~/jolt-pickleball-club/
   ```
4. **Run the bootstrap script** on the instance:
   ```bash
   cd ~/jolt-pickleball-club
   ./deploy/ec2-bootstrap.sh
   ```
   This installs Node 20, Nginx, production dependencies, and the systemd
   service — see the script's output for the manual steps it can't do for
   you (env file, DNS, certbot).
5. **Configure `server/.env`** (copy from `server/.env.example`). The
   settings that matter for this split-origin setup:
   ```
   NODE_ENV=production
   ALLOWED_ORIGINS=https://main.xxxxxxxxxx.amplifyapp.com
   CROSS_ORIGIN_COOKIES=true
   ```
   Leave `ALLOWED_ORIGINS` pointed at your Amplify domain for now — you can
   add your final custom domain later (comma-separated, no trailing
   slashes).
6. **Get an HTTPS certificate**: `sudo certbot --nginx -d api.joltz.club`.
   This isn't optional — `CROSS_ORIGIN_COOKIES=true` sets the session
   cookie's `Secure` flag, and browsers silently drop `Secure` cookies over
   plain HTTP. Login would appear to work (the response comes back fine)
   but the session would never actually persist.
7. **Start it**: `sudo systemctl start jolt`. Check `sudo systemctl status
   jolt` and `curl https://api.joltz.club/healthz` (expect
   `{"ok":true}`).

## Part 2 — The static site (AWS Amplify Hosting)

1. In the Amplify Console: **New app → Host web app** → connect this repo.
2. Amplify auto-detects `amplify.yml` at the repo root — no changes needed
   there unless you rename directories.
3. **App settings → Environment variables** → add:
   ```
   API_BASE_URL = https://api.joltz.club
   ```
   This is read at build time (`build.js`) and baked into every page as
   `window.JOLT_API_BASE`, so all the front-end's `fetch()` calls target
   your API host instead of relative paths.
4. Deploy. Amplify runs `npm ci && npm run build` and publishes `dist/`.
5. Once you have your Amplify domain (or a custom domain attached to the
   Amplify app), go back to `server/.env` on the API host and update
   `ALLOWED_ORIGINS` to match it exactly, then `sudo systemctl restart jolt`.

## Checking it actually works end to end

1. Visit your Amplify URL → `/book.html`.
2. Open the browser's Network tab, register an account. The request
   should go to `https://api.joltz.club/api/auth/register`, and
   the response should include a `Set-Cookie` header.
3. Reload the page. If you're still logged in, the cross-origin cookie
   round-trip is working. If you're logged out again, double-check:
   - `ALLOWED_ORIGINS` on the API matches the Amplify origin **exactly**
     (scheme + host, not a wildcard, no trailing slash)
   - `CROSS_ORIGIN_COOKIES=true` is actually set
   - The API is served over `https://`, not `http://`
   - `NODE_ENV=production` is set

## Cost/ops notes

- **Backups**: `deploy/backup-to-s3.sh` snapshots `server/data.db` to S3
  on a cron schedule. S3 is object storage, not a database service — this
  is just durability insurance for the one file everything relies on.
- **Scaling**: this architecture handles one API instance well. If you
  outgrow it, the honest next step is either (a) a managed Postgres
  database (RDS) if you're OK subscribing to one at that point, or (b)
  multiple app servers pointed at one shared Postgres/MySQL instead of
  per-instance SQLite files. Don't try to run multiple API instances
  against the same SQLite file — it's single-writer by design.
- **Custom domains**: put the Amplify app behind your root domain
  (`joltz.club`) via Amplify's domain management, and keep the API
  on a subdomain (`api.joltz.club`) with its own cert. Update
  `ALLOWED_ORIGINS` and `API_BASE_URL` if either domain changes.
