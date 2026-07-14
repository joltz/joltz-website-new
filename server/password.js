// server/password.js
// ---------------------------------------------------------------------------
// Password hashing via Node's built-in crypto.scrypt — deliberately avoids
// adding bcrypt/argon2 as a dependency. Stored format: 'salt:hash', both hex.
// ---------------------------------------------------------------------------
const crypto = require('crypto');

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const hashBuf = Buffer.from(hash, 'hex');
  const candidateBuf = crypto.scryptSync(String(password), salt, KEY_LENGTH);
  if (hashBuf.length !== candidateBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, candidateBuf);
}

module.exports = { hashPassword, verifyPassword };
