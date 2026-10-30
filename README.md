# Very Good Friends - site

Static page (`index.html` + `data*.js`) + three small serverless functions in `api/`:

- `api/order.js`   - order sheet -> emails you the request (reply goes straight to the customer)
- `api/contact.js` - contact page message -> emails you (reply goes straight to the visitor; if the function isn't reachable the page falls back to opening their mail app)
- `api/message.js` - "say it" terminal -> stores the message, shows it to everyone, emails you with a delete link

## Deploy (about 15 min)

1. **Accounts (free):** Vercel, Resend (resend.com), and an Upstash Redis database (add it from Vercel: Project > Storage > Marketplace > Upstash Redis).
2. **Resend:** create an API key. Without a verified domain Resend only delivers to the email you signed up with - that is fine, it is your own inbox (OWNER_EMAIL).
3. **Vercel:** drag this folder into a new project (or `npx vercel` in this folder).
4. **Environment variables** (Project > Settings > Environment Variables), see `.env.example`:
   `OWNER_EMAIL`, `RESEND_API_KEY`, `ADMIN_SECRET` (+ optional `FROM_EMAIL`, `CONFIRM_CUSTOMER`).
   The Upstash variables (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) are added automatically when you connect the database.
5. Redeploy once after adding the variables.
6. Test: send yourself an order request, and post a message from the folder.

## Moderation
- Every message goes live straight away (nothing is hidden automatically) and you get an email with a one-click **delete** link.
- Messages that score 100% on the word-list meter are marked `[FLAGGED]` in the subject, mild ones `[mild]`, so you can react first.
- Normal message emails stop after 40 a day (flagged ones and orders always go through), so Resend's free 100/day never blocks orders.
- Private overview with delete links: `https://YOURSITE/api/message?admin=<ADMIN_KEY>`
- Messages are capped at 25 characters, nicknames at 14, and each visitor can post 8 per minute.

## Editing the shop
Sizes: `SIZES` in `index.html`. 