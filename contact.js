// POST /api/contact -> emails you the contact-page message. Reply to that email to answer the visitor.
const { sendMail, esc, clean, limit, refund, body } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = await body(req);
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  const email = clean(b.email, 120);
  const message = String(b.message == null ? '' : b.message).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, 1000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'please enter a valid email' });
  if (!message) return res.status(400).json({ error: 'message is empty' });
  if (!(await limit(req, 'contact', 15, 3600))) return res.status(429).json({ error: 'too many messages, try again later' });
  const html = '<h2>New message from the site</h2><p style="white-space:pre-wrap">' + esc(message) + '</p><p><b>From:</b> ' + esc(email) + '</p><p>Just hit reply to answer.</p>';
  const text = 'New message from the site\n\n' + message + '\n\nFrom: ' + email;
  try {
    await sendMail({ subject: 'VGF message from ' + email, html, text, replyTo: email });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    await refund(req, 'contact'); // a failed send doesn't count
    return res.status(500).json({ error: 'could not send right now' });
  }
};
