// Cloudflare Pages Function: /functions/api/webhook/twilio-stop.js
// Twilio posts here when someone replies STOP, UNSUBSCRIBE, CANCEL, QUIT, or HELP.
// Configure this URL in Twilio Console → Phone Numbers → your number → Messaging → Webhook.

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const from = params.get('From') || '';
    const msgBody = (params.get('Body') || '').trim().toUpperCase();

    const optOutWords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
    if (!optOutWords.includes(msgBody)) {
      return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
    }

    // Normalize the phone number to match how it's stored
    const digits = from.replace(/\D/g, '');

    // Find clinic by phone — check both +1XXXXXXXXXX and plain 10-digit formats
    const { results } = await env.DB.prepare(
      `SELECT id FROM clinics WHERE replace(replace(replace(contact_phone, '+', ''), '-', ''), ' ', '') = ?`
    ).bind(digits.replace(/^1/, '')).all();

    for (const row of results) {
      await env.DB.prepare(
        `UPDATE clinics SET sms_opted_out = 1, sms_opted_out_at = datetime('now') WHERE id = ?`
      ).bind(row.id).run();
    }

    // Twilio expects a TwiML response
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }
}
