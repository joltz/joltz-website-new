// server/stripeClient.js
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn(
    '[stripe] STRIPE_SECRET_KEY is not set. Copy server/.env.example to server/.env ' +
    'and add your Stripe test keys before accepting real checkouts.'
  );
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20'
});

module.exports = stripe;
