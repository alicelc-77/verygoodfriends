// shared helpers: email (Resend), redis (Upstash REST), small utils
const crypto = require('crypto');

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  if (!RURL || !RTOK) throw new Error('redis not configured');
  const r = await fetch(RURL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RTOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function sendMail({ subject, html, text, replyTo, to }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY missing');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'Very Good Friends <onboarding@resend.dev>',
      to: [to || process.env.OWNER_EMAIL],
      reply_to: replyTo || undefined,
      subject, html, text,
    }),
  });
  if (!r.ok) throw new Error('mail failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, n) => Array.from(String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>&"`\\]/g, "").replace(/\s+/g, " ").trim()).slice(0, n).join("");
const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim();
const sign = (id) => crypto.createHmac('sha256', process.env.ADMIN_SECRET || 'change-me').update(String(id)).digest('hex').slice(0, 32);

async function limit(req, key, max, secs) {
  try {
    const k = 'vgf:rl:' + key + ':' + ip(req);
    const n = await redis(['INCR', k]);
    if (n === 1) await redis(['EXPIRE', k, secs]);
    return n <= max;
  } catch (e) { return true; } // never block on a redis hiccup
}

// give one attempt back (used when sending failed, so a failed order never counts against the visitor)
async function refund(req, key) {
  try { await redis(['DECR', 'vgf:rl:' + key + ':' + ip(req)]); } catch (e) {}
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

module.exports = { redis, sendMail, esc, clean, ip, sign, limit, refund, body };
