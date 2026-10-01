/**
 * Shared security helpers for the Motion Subtitle Studio server.
 *
 * - getSecret(name): returns a signing secret from the environment. If the
 *   env var is missing it generates a random per-boot secret and logs a loud
 *   warning. There is deliberately NO predictable default: the old hardcoded
 *   fallback strings were public (this repo is public) so anyone could forge
 *   signed tokens when the env var was unset.
 * - securityHeaders: minimal hardening headers (helmet-lite, zero new deps).
 * - rateLimit: tiny in-memory sliding-window rate limiter (no new deps).
 */
const crypto = require('crypto');

const warned = new Set();

function getSecret(name) {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.trim().length >= 16) {
    return fromEnv;
  }
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(
      `[security] WARNING: ${name} is not set (or is too short). ` +
      `Using a random per-boot secret. Set a long random ${name} in production ` +
      `e.g. \`openssl rand -hex 32\`. Signed tokens will not survive restarts until you do.`
    );
  }
  // Cache per name so every caller in this process shares one boot secret.
  if (!getSecret.cache) getSecret.cache = {};
  if (!getSecret.cache[name]) {
    getSecret.cache[name] = crypto.randomBytes(32).toString('hex');
  }
  return getSecret.cache[name];
}

function securityHeaders(req, res, next) {
  // Block MIME-sniffing driven XSS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // This server has no legitimate framing use; the marketing site is separate
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Limit referrer leakage on outbound navigations
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Opt out of FLoC / interest-cohort tracking
  res.setHeader('Permissions-Policy', 'interest-cohort=()');
  next();
}

/**
 * Sliding-window in-memory rate limiter.
 * options: { windowMs, max, message }
 * Counts per IP; X-Forwarded-For is honoured only from loopback (Render's
 * proxy) — Express is not in trust-proxy mode here, so req.ip is the direct
 * peer. Good enough for abuse dampening, not a security boundary.
 */
function rateLimit({ windowMs = 60000, max = 120, message = 'Too many requests, slow down.' } = {}) {
  const hits = new Map(); // ip -> array of timestamps
  // Periodic cleanup so the map can't grow forever
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, times] of hits) {
      const fresh = times.filter(t => t > cutoff);
      if (fresh.length) hits.set(ip, fresh);
      else hits.delete(ip);
    }
  }, windowMs);
  if (timer.unref) timer.unref();

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;
    const times = (hits.get(ip) || []).filter(t => t > cutoff);
    if (times.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: message });
    }
    times.push(now);
    hits.set(ip, times);
    next();
  };
}

module.exports = { getSecret, securityHeaders, rateLimit };
