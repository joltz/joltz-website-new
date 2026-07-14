// server/config.js
// ---------------------------------------------------------------------------
// Operating hours for slot generation. Change these to match real hours —
// everything else (availability, checkout) derives from this.
// ---------------------------------------------------------------------------
module.exports = {
  openHour: 7,        // 7am
  closeHour: 21,       // 9pm (last bookable slot starts at 20:00)
  slotMinutes: 60,     // 1-hour slots
  timezone: 'America/Los_Angeles',
  maxSlotsPerBooking: 4,       // cap a single booking at 4 hours
  bookingWindowDays: 21        // how many days ahead people can book
};
