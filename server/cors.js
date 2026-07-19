// server/cors.js
// ---------------------------------------------------------------------------
// Hand-rolled CORS support — no extra dependency needed. Only relevant when
// the front-end is served from a different origin than this API (e.g. the
// static site on AWS Amplify Hosting calling an API on a separate EC2 host).
// For same-origin deployments (the Express server also serving dist/),
// ALLOWED_ORIGINS can be left unset and this middleware is a no-op.
//
// Because the booking/admin API uses cookies for auth, the allowed origin
// must be echoed back exactly (never '*') and
// Access-Control-Allow-Credentials must be 'true' — otherwise browsers
// silently refuse to send/receive the session cookie cross-site.
// ---------------------------------------------------------------------------
function parseAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsMiddleware(req, res, next) {
  const allowed = parseAllowedOrigins();
  if (allowed.length === 0) return next(); // same-origin deployment — nothing to do

  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  next();
}

module.exports = corsMiddleware;
