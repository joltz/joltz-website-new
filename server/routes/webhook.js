// server/routes/webhook.js
// ---------------------------------------------------------------------------
// This is the authoritative confirmation path: Stripe calls this endpoint
// directly (server-to-server) once a checkout session finishes, so it works
// even if the customer closes their browser tab before it redirects back.
//
// IMPORTANT: this route needs the raw request body (not JSON-parsed) to
// verify the Stripe signature — see server/index.js for how it's mounted.
// ---------------------------------------------------------------------------
const express = require('express');
const { db } = require('../db');
const stripe = require('../stripeClient');

const router = express.Router();

router.post('/', (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (!webhookSecret) {
      // Local dev without a configured webhook secret: trust the parsed body.
      // Never do this in production — always verify the signature.
      event = JSON.parse(req.body.toString());
    } else {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    }
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const bookingId = Number(session.metadata && session.metadata.bookingId);
      if (bookingId) {
        db.prepare(
          "UPDATE bookings SET status = 'paid', stripe_payment_intent = ? WHERE id = ? AND status != 'paid'"
        ).run(session.payment_intent, bookingId);
      }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      const bookingId = Number(session.metadata && session.metadata.bookingId);
      if (bookingId) {
        db.prepare(
          "UPDATE bookings SET status = 'expired' WHERE id = ? AND status = 'pending'"
        ).run(bookingId);
      }
      break;
    }
    default:
      break; // ignore other event types
  }

  res.json({ received: true });
});

module.exports = router;
