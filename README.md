# Jolt Pickleball Club — Website

A marketing + shop site for a pickleball club selling paddles, apparel,
nets and interlocking court tiles — plus a **Book a Court** page that lets
people reserve an hourly court slot and pay online.

The marketing/shop pages are static HTML/CSS/JS assembled by a small Node
build script. The booking page is backed by a small Express server, a
SQLite database, and Stripe Checkout for payment.

## Structure

```
pickleball-club/
├── build.js                # Assembles src/ into dist/ (static pages)
├── deploy.sh                # Ships dist/ to a static hosting target
├── package.json             # npm run build / dev / deploy / server
├── src/
│   ├── config.json          # Brand name, email, phone, address, nav, year
│   ├── partials/             # shell / head / header / footer
│   ├── pages/
│   │   ├── index.html       # Home / marketing page
│   │   ├── shop.html        # Paddles, apparel, nets, court tiles
│   │   ├── contact.html     # Contact form + direct contact info
│   │   ├── book.html        # Book a Court — courts, slots, payment
│   │   ├── admin.html       # Admin — settings, courts, bookings/payments
│   │   └── 404.html
│   └── assets/
│       ├── css/style.css
│       ├── js/main.js        # nav, contact form, carousels, etc.
│       ├── js/auth.js         # shared login/register/logout helper
│       ├── js/booking.js     # login gate + court/date/slot picker + checkout
│       ├── js/admin.js       # admin login gate + settings/courts/users/bookings UI
│       └── img/
├── dist/                    # Generated static output
└── server/                  # Booking + admin API — required for book.html
    │                        # and admin.html to work
    ├── index.js              # Express app entrypoint
    ├── db.js                 # SQLite schema + court/settings seeding +
    │                          # first-admin bootstrap from env
    ├── config.js              # Default operating hours (fallback only —
    │                          # admin.html overrides these at runtime)
    ├── settings.js             # Reads/writes the DB-backed settings admins edit
    ├── slots.js                # Slot-grid generation helpers
    ├── validate.js             # Booking + email validation rules
    ├── password.js              # Password hashing (Node's built-in scrypt)
    ├── session.js                # Cookie sessions + requireAuth/requireAdmin
    ├── stripeClient.js          # Stripe SDK init
    ├── routes/
    │   ├── auth.js               # POST /register, /login, /logout, GET /me
    │   ├── courts.js            # GET  /api/courts (public, active only)
    │   ├── availability.js      # GET  /api/availability
    │   ├── bookings.js          # POST /api/bookings/checkout, GET /confirm, /mine
    │   ├── webhook.js           # POST /api/stripe/webhook
    │   └── admin.js              # Admin-only: settings, courts, users/roles, bookings
    ├── .env.example
    └── data.db                # Created automatically on first run
```

## Requirements

- Node.js 18+
- A free [Stripe](https://stripe.com) account (test mode is fine) — only
  needed for the Book a Court page

## Commands

```bash
npm install            # installs express, better-sqlite3, stripe, dotenv
npm run build          # builds the static site into dist/
npm run dev             # build + serve dist/ only (no booking API)
npm run server           # build + run the full stack (static site + booking API)
npm run server:dev        # same, but restarts on file changes (nodemon)
npm run stripe:listen      # forwards Stripe webhook events to your local server
```

Use `npm run dev` while you're just working on marketing/shop copy and
design — it's instant and doesn't need Stripe keys. Use `npm run server`
whenever you need the Book a Court page to actually work.

## Setting up payments (Stripe)

1. Create a Stripe account and grab your **test-mode** keys from
   `https://dashboard.stripe.com/test/apikeys`.
2. Copy `server/.env.example` to `server/.env` and fill in:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET` (see below)
3. In one terminal, run the webhook forwarder (requires the
   [Stripe CLI](https://stripe.com/docs/stripe-cli)):
   ```bash
   npm run stripe:listen
   ```
   This prints a `whsec_...` value — put that in `server/.env` as
   `STRIPE_WEBHOOK_SECRET`.
4. In another terminal: `npm run server`.
5. Visit `http://localhost:3000/book.html`, create an account (or log in),
   and book a slot using a
   [Stripe test card](https://stripe.com/docs/testing) (e.g.
   `4242 4242 4242 4242`, any future expiry, any CVC).

Without `server/.env` configured, the site still builds and runs, but
checkout will fail since there's no real Stripe key.

## How booking works

- **Courts & pricing** live in the `courts` table (seeded automatically on
  first run — edit `server/db.js` to change names, hourly rates, or add
  more courts).
- **Availability** (`GET /api/availability?courtId=&date=`) generates the
  day's slots from `server/config.js` (open/close hour, slot length) and
  marks any slot already `pending` or `paid` in the `bookings` table as
  unavailable. Slots in the past are also marked unavailable.
- **Checkout** (`POST /api/bookings/checkout`) re-validates the requested
  slots are contiguous, in-bounds, and still free, writes a `pending`
  booking row, then creates a Stripe Checkout Session for
  `hourly_rate × hours` and returns its URL for the browser to redirect to.
- **Confirmation** happens two ways, both handled:
  - The **Stripe webhook** (`POST /api/stripe/webhook`) is the source of
    truth — it marks the booking `paid` the moment Stripe confirms payment,
    even if the customer closes the tab before returning.
  - The **success page** (`book.html?session_id=...`) also double-checks
    the session directly with Stripe as a fallback, so confirmations show
    up instantly in local dev even without the webhook forwarder running.
- **Abandoned checkouts**: a `pending` booking that's never paid stops
  blocking the slot after 15 minutes (see `PENDING_HOLD_MINUTES` in
  `server/db.js`), and is also marked `expired` if Stripe reports the
  checkout session itself expired.

To change court names, hourly rates, operating hours, slot length, the
booking window, or the max hours per booking, use the admin panel below —
no code changes needed for any of that.

## Accounts & roles

Booking a court and using the admin panel both go through the same login
system — real accounts stored in the `users` table, not a shared password.

- **Anyone can create an account** from the Book a Court page (tab over to
  "Create Account") — this is what lets them book and pay for a court, and
  see their own booking history.
- **Every account has a role**: `user` (default) or `admin`. Only `admin`
  accounts can reach `/admin.html`; a logged-in `user` who tries gets a
  clear "not authorized" screen instead of the dashboard, rather than a
  confusing error.
- **The first admin is bootstrapped from `server/.env`** the very first
  time the server runs (only when the `users` table is empty):
  ```
  ADMIN_NAME=Admin
  ADMIN_EMAIL=you@joltpickleball.com
  ADMIN_PASSWORD=change-me-to-something-long-and-random
  ```
  After that, these three variables are ignored — manage who else is an
  admin from the **Users & Roles** panel inside `/admin.html` itself
  (promote/demote with one click). You can't demote the last remaining
  admin, so you can't accidentally lock yourself out.
- **Sessions** are a random token in an HttpOnly, SameSite=Lax cookie,
  valid for 7 days, checked against a `sessions` row on every request.
  Passwords are hashed with Node's built-in `scrypt` (see
  `server/password.js`) — no extra dependency needed.
- Booking checkout (`/api/bookings/checkout`) and everything under
  `/api/admin/*` require a valid session; the booking and admin pages
  show a login form instead of silently failing when you're not
  authenticated.

If you need social login, email verification, or password reset, that's a
step up from what's here — the `users`/`sessions` tables and
`server/session.js` are the place to extend from.

## Admin panel

Visit `/admin.html`, log in with an admin account, and you can:

- **Edit operating hours & slot rules** — opening/closing hour, slot
  length (30/60/90/120 min), max hours per booking, and how many days
  ahead people can book. Changes apply immediately, site-wide.
- **Manage courts** — edit each court's name, description and hourly
  rate inline, toggle a court active/inactive, or add a new one.
  Deactivating a court hides it from the public Book a Court page but
  keeps its booking history intact (courts are never hard-deleted, since
  bookings reference them).
- **Manage users & roles** — see everyone with an account and promote or
  demote between `user` and `admin` with one click.
- **See every booking and payment** — a filterable table (by status,
  court, and date range) plus summary stats: total revenue collected,
  paid/pending counts, today's bookings, and upcoming bookings.

## Editing content

- **Brand info, email, phone, address, social links, nav:** edit
  `src/config.json`. These values are injected wherever `{{CONTACT_EMAIL}}`,
  `{{PHONE}}`, `{{ADDRESS}}`, etc. appear in the partials and pages.
- **Page copy:** edit the relevant file in `src/pages/`.
- **Products:** each product is a `.product-card` block in `shop.html` —
  copy an existing card and change the name, description, price and the
  `Enquire` link's `topic`/`item` query params (these pre-fill the contact
  form automatically).
- **Styling:** all design tokens (colors, fonts, spacing) are CSS custom
  properties at the top of `src/assets/css/style.css`.

## The contact form

The contact page has no backend of its own — it builds a `mailto:` link
from the visitor's input and opens their email client with the subject
and message pre-filled, addressed to the email in `config.json`. If you'd
rather collect submissions server-side, swap the submit handler in
`src/assets/js/main.js` for a call to a form backend (e.g. Formspree,
Netlify Forms, or your own API).

## Deploying

**Marketing/shop pages only (no booking):** `deploy.sh` builds and ships
`dist/` to a static host:

```bash
./deploy.sh netlify     # Netlify CLI (npx netlify-cli)
./deploy.sh vercel      # Vercel CLI (npx vercel)
./deploy.sh gh-pages    # Publish dist/ to a gh-pages branch
./deploy.sh rsync       # rsync dist/ to your own server (edit REMOTE first)
./deploy.sh zip         # Just zip dist/ for manual upload anywhere
```

**With Book a Court working:** static hosts can't run the booking API or
database, so you need a real Node host instead — e.g. Render, Railway,
Fly.io, or your own VPS. Point it at `npm run server` as the start command,
set the `STRIPE_*` and `ADMIN_*` environment variables from `server/.env`
in that platform's dashboard, and register a webhook endpoint at
`https://yourdomain.com/api/stripe/webhook` in the Stripe dashboard once
it's live (this replaces `npm run stripe:listen`, which is for local dev
only).

The SQLite file at `server/data.db` is created automatically and holds all
bookings — back it up periodically, or swap `server/db.js` for a hosted
Postgres/MySQL database if you outgrow a single file (the query patterns
are simple and port over easily).
