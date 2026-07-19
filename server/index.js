// server/index.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path = require('path');
const express = require('express');

const { getSettings } = require('./settings');
const { attachUser, requireAuth, requireAdmin } = require('./session');
const corsMiddleware = require('./cors');
const authRouter = require('./routes/auth');
const courtsRouter = require('./routes/courts');
const availabilityRouter = require('./routes/availability');
const bookingsRouter = require('./routes/bookings');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, '..', 'dist');

app.set('trust proxy', 1); // correct req.protocol/secure behind an ALB/Nginx/CloudFront

// Health check for load balancers, ECS/EC2 monitoring, or just a quick
// "is the API and DB up" smoke test. Deliberately unauthenticated.
app.get('/healthz', (req, res) => {
  try {
    require('./db').db.prepare('SELECT 1').get();
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'database unavailable' });
  }
});

// CORS must run before routes so preflight OPTIONS requests are answered;
// it's a no-op unless ALLOWED_ORIGINS is set (see server/cors.js).
app.use(corsMiddleware);

// The Stripe webhook needs the raw, unparsed body to verify its signature,
// so it must be mounted BEFORE express.json() below.
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), webhookRouter);

app.use(express.json());
app.use(attachUser); // sets req.user (or null) on every request from here on

app.get('/api/config', (req, res) => {
  const settings = getSettings();
  res.json({
    openHour: settings.openHour,
    closeHour: settings.closeHour,
    slotMinutes: settings.slotMinutes,
    maxSlotsPerBooking: settings.maxSlotsPerBooking,
    bookingWindowDays: settings.bookingWindowDays,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
  });
});

app.use('/api/auth', authRouter);                    // public: register/login/logout/me
app.use('/api/courts', courtsRouter);                // public: browse courts
app.use('/api/availability', availabilityRouter);    // public: browse slots
app.use('/api/bookings', requireAuth, bookingsRouter); // logged-in users only
app.use('/api/admin', requireAdmin, adminRouter);     // admin role only

// Serve the built static marketing/shop/booking/admin pages. admin.html and
// book.html are safe to serve to anyone — they render a login gate
// client-side and only fetch real data once /api/auth/me confirms who's
// logged in (and, for admin.html, that their role is 'admin').
app.use(express.static(DIST_DIR));

app.use((req, res) => {
  res.status(404).sendFile(path.join(DIST_DIR, '404.html'));
});

app.listen(PORT, () => {
  console.log(`▲ Jolt Pickleball Club server running at http://localhost:${PORT}`);
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('  (Stripe test key not set — checkout will fail until server/.env is configured. See server/.env.example.)');
  }
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.log('  (ADMIN_EMAIL/ADMIN_PASSWORD not set — no admin account was auto-created. See server/.env.example.)');
  }
  if (process.env.ALLOWED_ORIGINS && process.env.CROSS_ORIGIN_COOKIES !== 'true') {
    console.log('  (ALLOWED_ORIGINS is set but CROSS_ORIGIN_COOKIES is not "true" — login cookies will be rejected ' +
      'by browsers on cross-site requests. Set CROSS_ORIGIN_COOKIES=true if the front-end is on a different domain, e.g. AWS Amplify.)');
  }
});
