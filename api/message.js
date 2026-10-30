// GET  /api/message                    -> latest public messages  [{n,t}]
// POST /api/message {n,t}              -> store (always live) + email you, flagged ones are marked
// GET  /api/message?del=ID&sig=S       -> delete a message          (link from the email)
// GET  /api/message?admin=ADMIN_KEY    -> private list of recent messages with delete links
const { redis, sendMail, esc, clean, sign, limit, body } = require('./_lib');
const { modScore } = require('./_mod');

const LIST = 'vgf:msgs';
const DAILY_MSG_EMAILS = 40; // normal messages: max emails/day, so Resend's free 100/day always has room for orders + flagged ones

const find = (arr, id) => (arr || []).find((s) => { try { return JSON.parse(s).id === id; } catch (e) { return false; } });
const page = (res, html) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.status(200).send('<meta name="viewport" content="width=device-width"><body style="font:16px system-ui;padding:20px">' + html); };

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = (act, id) => 'https://' + host + '/api/message?' + act + '=' + id + '&sig=' + sign(act + id);
    if (req.method === 'GET') {
      if (q.del) {
        if (sign('del' + q.del) !== q.sig) return res.status(403).send('bad link');
        const hm = find(await redis(['LRANGE', LIST, 0, 199]), q.del);
        if (hm) await redis(['LREM', LIST, 1, hm]);
        return page(res, hm ? '<h3>deleted</h3>' : '<h3>already gone</h3>');
      }
      if (q.admin) {
        if (!process.env.ADMIN_KEY || q.admin !== process.env.ADMIN_KEY) return res.status(403).send('no');
        const row = (s) => { try { const m = JSON.parse(s); return '<tr><td>' + (m.score >= 100 ? '&#9888;' : m.score >= 65 ? '~' : '') + '</td><td><b>' + esc(m.n) + '</b>: ' + esc(m.t) + '</td><td><a href="' + url('del', m.id) + '">delete</a></td></tr>'; } catch (e) { return ''; } };
        const pub = await redis(['LRANGE', LIST, 0, 49]);
        return page(res, '<h2>messages</h2><table cellpadding="6">' + (pub || []).map(row).join('') + '</table>');
      }
      const all = (await redis(['LRANGE', LIST, 0, 29])) || [];
      const out = all.map((s) => { try { const m = JSON.parse(s); return { n: m.n, t: m.t }; } catch (e) { return null; } }).filter(Boolean);
      res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
      return res.status(200).json(out);
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
    const b = await body(req);
    const n = clean(b.n, 14), t = clean(b.t, 25);
    if (!n || !t) return res.status(400).json({ error: 'nickname and message needed' });
    if (!(await limit(req, 'msg', 8, 60))) return res.status(429).json({ error: 'slow down' });
    const score = modScore(n + ' ' + t), flagged = score >= 100;
    const id = require('crypto').randomBytes(5).toString('hex');
    await redis(['LPUSH', LIST, JSON.stringify({ id, n, t, ts: Date.now(), score })]);
    await redis(['LTRIM', LIST, 0, 199]);
    // flagged messages always email you; normal ones stop after DAILY_MSG_EMAILS per day
    let mail = true;
    if (!flagged) { try { const k = 'vgf:mails:' + new Date().toISOString().slice(0, 10), c = await redis(['INCR', k]); if (c === 1) await redis(['EXPIRE', k, 172800]); mail = c <= DAILY_MSG_EMAILS; } catch (e) {} }
    if (mail) {
      const del = url('del', id);
      sendMail({
        subject: (flagged ? '[FLAGGED] ' : score >= 65 ? '[mild] ' : '') + 'VGF message: ' + n + ' said "' + t + '"',
        html: '<p><b>' + esc(n) + '</b> said:</p><p style="font-size:18px">' + esc(t) + '</p><p>moderation score: ' + score + '%</p><p><a href="' + del + '">delete this message</a></p>',
        text: n + ' said: ' + t + '\nscore ' + score + '%\nDelete: ' + del,
      }).catch((e) => console.error(e));
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
};
