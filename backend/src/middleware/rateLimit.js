function rateLimit({ windowMs, max, name }) {
  const hits = new Map();
  return function limit(req, res, next) {
    const key = `${name}:${req.user?.id || req.ip}`;
    const now = Date.now();
    const start = now - windowMs;
    const list = (hits.get(key) || []).filter((t) => t > start);
    if (list.length >= max) {
      const retrySec = Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({ ok: false, error: 'Too many requests. Try again later.' });
    }
    list.push(now);
    hits.set(key, list);
    next();
  };
}

const FIFTEEN_MIN = 15 * 60 * 1000;

const exportLimit = rateLimit({ windowMs: FIFTEEN_MIN, max: 30, name: 'export' });
const importLimit = rateLimit({ windowMs: FIFTEEN_MIN, max: 10, name: 'import' });

module.exports = { rateLimit, exportLimit, importLimit };
