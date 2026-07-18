// Google Apps Script Web App: relays outbound CRM email through Gmail.
//
// Why this exists: sending through Gmail's own infrastructure (instead of a
// third-party ESP like Resend) means Gmail recognizes the sender as a real
// Google Account and shows that account's profile photo as the avatar to
// anyone viewing the message in Gmail.
//
// Setup:
//   1. Go to https://script.google.com while logged into alignment.automations@gmail.com
//   2. New project → paste this file's contents in as Code.gs
//   3. Replace SHARED_SECRET below with the value provided (matches APPSSCRIPT_SECRET)
//   4. Deploy → New deployment → type: Web app
//        Execute as: Me (alignment.automations@gmail.com)
//        Who has access: Anyone
//   5. Copy the deployment URL — send it back so it can be wired in as APPSSCRIPT_URL

const SHARED_SECRET = 'Gbr9HBz320tFWCVCjcj07lghk1Ju4X5o';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.secret !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }
    if (!body.to || !body.subject) {
      return jsonResponse({ ok: false, error: 'Missing to/subject' });
    }

    const options = { name: 'Alignment Automations' };
    if (body.html) options.htmlBody = body.html;
    if (body.from) options.from = body.from; // must be a verified "Send As" alias on this account

    GmailApp.sendEmail(body.to, body.subject, body.text || '', options);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
