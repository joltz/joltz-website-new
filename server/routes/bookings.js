// server/routes/bookings.js
// NOTE: mounted behind requireAuth in server/index.js — req.user is always
// present here.
const express = require('express');
const { db, releaseStalePending } = require('../db');
const { isValidDateStr, isSlotInPast } = require('../slots');
const { validateSlots } = require('../validate');
const stripe = require('../stripeClient');

const router = express.Router();

router.post('/checkout', async (req, res) => {
  try {
    const { courtId, date, slots } = req.body || {};
    const { id: userId, name, email } = req.user;

    if (!courtId) return res.status(400).json({ error: 'courtId is required' });
    if (!isValidDateStr(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

    const slotError = validateSlots(slots);
    if (slotError) return res.status(400).json({ error: slotError });

    const court = db.prepare('SELECT * FROM courts WHERE id = ? AND active = 1').get(Number(courtId));
    if (!court) return res.status(404).json({ error: 'Court not found' });

    const sorted = [...slots].sort((a, b) => (a.start < b.start ? -1 : 1));
    const startTime = sorted[0].start;
    const endTime = sorted[sorted.length - 1].end;

    if (sorted.some((s) => isSlotInPast(date, s.start))) {
      return res.status(400).json({ error: 'One of the selected slots is already in the past.' });
    }

    releaseStalePending();

    const conflict = db
      .prepare(
        `SELECT id FROM bookings
         WHERE court_id = ? AND booking_date = ? AND status IN ('pending', 'paid')
           AND start_time < ? AND end_time > ?`
      )
      .get(court.id, date, endTime, startTime);
    if (conflict) {
      return res.status(409).json({ error: 'Sorry, one of those slots was just booked. Pick another.' });
    }

    const amountCents = court.hourly_rate_cents * sorted.length;

    const insert = db.prepare(
      `INSERT INTO bookings
        (court_id, user_id, booking_date, start_time, end_time, slot_count, customer_name, customer_email, amount_cents, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    );
    const result = insert.run(
      court.id, userId, date, startTime, endTime, sorted.length, name, email, amountCents
    );
    const bookingId = result.lastInsertRowid;

    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${court.name} — ${date} ${startTime}–${endTime}`,
              description: `Jolt Pickleball Club court booking (${sorted.length}h)`
            },
            unit_amount: amountCents
          },
          quantity: 1
        }
      ],
      metadata: { bookingId: String(bookingId) },
      success_url: `${origin}/book.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book.html?canceled=1`
    });

    db.prepare('UPDATE bookings SET stripe_session_id = ? WHERE id = ?').run(session.id, bookingId);

    res.json({ url: session.url });
  } catch (err) {
    console.error('[bookings/checkout]', err);
    res.status(500).json({ error: 'Something went wrong creating your booking. Please try again.' });
  }
});

router.get('/confirm', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '');
    if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

    const booking = db
      .prepare(
        `SELECT b.*, c.name AS court_name FROM bookings b
         JOIN courts c ON c.id = b.court_id
         WHERE b.stripe_session_id = ?`
      )
      .get(sessionId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Only the person who made the booking (or an admin) can view it.
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'This booking belongs to a different account.' });
    }

    // Fallback confirmation path for local dev without the Stripe CLI webhook
    // forwarder running — double-check the session directly with Stripe.
    if (booking.status === 'pending') {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid') {
        db.prepare(
          "UPDATE bookings SET status = 'paid', stripe_payment_intent = ? WHERE id = ?"
        ).run(session.payment_intent, booking.id);
        booking.status = 'paid';
      }
    }

    res.json({
      booking: {
        court: booking.court_name,
        date: booking.booking_date,
        start: booking.start_time,
        end: booking.end_time,
        amountCents: booking.amount_cents,
        status: booking.status,
        name: booking.customer_name,
        email: booking.customer_email
      }
    });
  } catch (err) {
    console.error('[bookings/confirm]', err);
    res.status(500).json({ error: 'Could not verify this booking.' });
  }
});

// A logged-in customer's own booking history (used to show "your bookings"
// on the Book a Court page).
router.get('/mine', (req, res) => {
  releaseStalePending();
  const bookings = db
    .prepare(
      `SELECT b.*, c.name AS court_name FROM bookings b
       JOIN courts c ON c.id = b.court_id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC, b.start_time DESC`
    )
    .all(req.user.id);
  res.json({ bookings });
});

module.exports = router;
