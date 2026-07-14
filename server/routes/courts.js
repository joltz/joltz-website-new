// server/routes/courts.js
const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const courts = db
    .prepare('SELECT id, name, hourly_rate_cents, description FROM courts WHERE active = 1 ORDER BY id')
    .all();
  res.json({ courts });
});

module.exports = router;
