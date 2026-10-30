// POST /api/order  -> emails you the order request. Reply to that email to reach the customer.
const { sendMail, esc, clean, limit, refund, body } = require('./_lib');

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = await body(req);
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: bots fill this, pretend success
  const email = clean(b.email, 120);
  const comment = clean(b.comment, 500);
  // one request for the whole bag (b.items) or a single item (b.item) from the shop's order sheet
  const raw = Array.isArray(b.items) ? b.items.slice(0, 30) : [b];
  const items = raw.map((x) => ({
    item: clean(x.item, 80),
    idx: x.idx ? clean(x.idx, 3) : '',
    cut: clean(x.cut, 20),
    color: /^#[0-9a-fA-F]{6}$/.test(x.color || '') ? x.color : '',
    colorFor: clean(x.colorFor, 10),
    size: clean(x.size, 4).toUpperCase(),
    qty: Math.min(20, Math.max(1, parseInt(x.qty, 10) || 1)),
  }));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'please enter a valid email' });
  if (!items.length) return res.status(400).json({ error: 'missing item' });
  if (items.some((x) => !x.item)) return res.status(400).json({ error: 'missing item' });
  if (items.some((x) => !SIZES.includes(x.size))) return res.status(400).json({ error: 'please pick a size' });
  if (!(await limit(req, 'order', 30, 3600))) return res.status(429).json({ error: 'too many requests, try again later' });

  const sw = (x) => (x.color ? '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' + x.color + ';border:1px solid #888;vertical-align:middle"></span> ' + x.color + (x.colorFor ? ' (' + esc(x.colorFor) + ')' : '') : '-');
  const head = '<tr><th align="left">Item</th><th align="left">Cut</th><th align="left">Colour</th><th align="left">Size</th><th align="left">Qty</th></tr>';
  const rows = items.map((x) => '<tr><td>' + esc(x.item) + (x.idx ? ' (#' + esc(x.idx) + ')' : '') + '</td><td>' + esc(x.cut) + '</td><td>' + sw(x) + '</td><td>' + esc(x.size) + '</td><td>' + x.qty + '</td></tr>').join('');
  const html = '<h2>New order request</h2><table cellpadding="6">' + head + rows + '</table><p><b>Customer email:</b> ' + esc(email) + '<br><b>Comments:</b> ' + (esc(comment) || '-') + '</p><p>Just hit reply to answer the customer.</p>';
  const text = 'New order request\n' + items.map((x) => '- ' + x.item + ' / ' + x.size + ' x' + x.qty + (x.color ? ' / ' + x.color : '')).join('\n') + '\nEmail: ' + email + '\nComments: ' + (comment || '-');
  const subject = 'VGF order: ' + (items.length === 1 ? items[0].item + ' / ' + items[0].size + ' x' + items[0].qty : items.length + ' items (' + items.reduce((n, x) => n + x.qty, 0) + ' pcs)');
  try {
    await sendMail({ subject, html, text, replyTo: email });
    if (process.env.CONFIRM_CUSTOMER === '1') {
      await sendMail({ to: email, subject: 'Very Good Friends - we got your order request', text: 'Hi! Your order request (' + items.length + (items.length === 1 ? ' item' : ' items') + ') arrived. I will email you back soon with the payment details. - Very Good Friends' }).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    await refund(req, 'order'); // a failed send doesn't count
    return res.status(500).json({ error: 'could not send right now, please try again or email me directly' });
  }
};
