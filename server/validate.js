// server/validate.js
// Pure-ish validation helpers — kept separate from the route handlers so the
// core booking rules can be unit tested without spinning up Express/Stripe.
const { generateDaySlots } = require('./slots');
const { getSettings } = require('./settings');

function isEmail(str) {
  return typeof str === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/** Returns an error string, or null if the slot list is valid. */
function validateSlots(slots) {
  const { maxSlotsPerBooking } = getSettings();
  if (!Array.isArray(slots) || slots.length === 0) return 'Select at least one time slot.';
  if (slots.length > maxSlotsPerBooking) return `Bookings are capped at ${maxSlotsPerBooking} hours.`;

  const daySlots = generateDaySlots();
  const validPairs = new Set(daySlots.map((s) => `${s.start}-${s.end}`));
  for (const s of slots) {
    if (!s || !validPairs.has(`${s.start}-${s.end}`)) return 'One of the selected slots is invalid.';
  }

  const sorted = [...slots].sort((a, b) => (a.start < b.start ? -1 : 1));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].end !== sorted[i].start) return 'Selected slots must be back-to-back.';
  }
  return null;
}

module.exports = { isEmail, validateSlots };
