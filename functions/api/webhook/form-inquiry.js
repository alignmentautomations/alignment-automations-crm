// Cloudflare Pages Function: /functions/api/webhook/form-inquiry.js

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret',
};

function uid() {
  return crypto.randomUUID();
}

function delayMs(delay, unit) {
  switch (unit) {
    case 'minutes': return delay * 60 * 1000;
    case 'hours':   return delay * 60 * 60 * 1000;
    case 'days':    return delay * 24 * 60 * 60 * 1000;
    default:        return delay * 60 * 60 * 1000;
  }
}

function applyTemplate(text, vars) {
  if (!text) return text;
  return text
    .replace(/\{\{first_name\}\}/gi, vars.first_name || 'there')
    .replace(/\{\{last_name\}\}/gi,  vars.last_name  || '')
    .replace(/\{\{clinic_name\}\}/gi,   vars.clinic_name   || '')
    .replace(/\{\{business_name\}\}/gi, vars.business_name || vars.clinic_name || '')
    .replace(/\{\{email\}\}/gi,      vars.email       || '')
    .replace(/\{\{phone\}\}/gi,      vars.phone       || '');
}

// Converts the plain-text template body into the branded HTML shell.
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function textToHtml(text) {
  let out = escapeHtml(text || '');
  out = out.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#0066CC;text-decoration:underline;">$1</a>');
  return out.replace(/\n/g, '<br>');
}
function wrapEmailHtml(bodyText) {
  return `<!doctype html>
<html>
  <head>
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  </head>
  <body style="margin:0;padding:0;background:#F4F7FB;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E9F1;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:22px 28px;border-bottom:1px solid #E2E9F1;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:56px;height:56px;background-image:url('https://app.alignmentautomations.com/logo-email.png?v=6');background-size:52px 52px;background-repeat:no-repeat;background-position:center;text-align:center;"></td>
              <td style="padding-left:12px;font-family:Arial,sans-serif;font-size:16px;">
                <span style="font-weight:700;color:#1A1A1A;">Alignment</span><span style="font-weight:400;color:#0066CC;"> Automations</span>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#242A2E;">
            ${textToHtml(bodyText)}
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #E2E9F1;font-family:Arial,sans-serif;font-size:12px;color:#8A929C;">
            Alignment Automations &middot; alignment.automations@gmail.com
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// Sends through the Google Apps Script relay (google-apps-script/mail-relay.gs),
// which calls GmailApp.sendEmail from alignment.automations@gmail.com — this
// makes Gmail recognize the sender as a real Google Account and show its
// profile photo as the avatar to recipients viewing in Gmail.
async function sendEmail(to, subject, body, env) {
  if (!env.APPSSCRIPT_URL)    throw new Error('APPSSCRIPT_URL is not set');
  if (!env.APPSSCRIPT_SECRET) throw new Error('APPSSCRIPT_SECRET is not set');
  const res = await fetch(env.APPSSCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.APPSSCRIPT_SECRET,
      to,
      from: env.FROM_EMAIL,
      subject: subject || '(no subject)',
      text: body || '',
      html: wrapEmailHtml(body || ''),
    }),
  });
  const raw = await res.text();
  let json = null;
  try { json = JSON.parse(raw); } catch (_) {}
  if (!res.ok || !json?.ok) {
    throw new Error(`Apps Script relay rejected send (HTTP ${res.status}): ${raw}`);
  }
  return json;
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

  try {
    const authHeader = request.headers.get('x-webhook-secret');
    if (authHeader !== env.WEBHOOK_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json();
    // Accept business_name (current) or clinic_name (legacy) from the inbound form.
    const { first_name, last_name, email, phone, package: pkg } = body;
    const businessName = body.business_name || body.clinic_name;

    if (!email) {
      return json({ error: 'email required' }, 400);
    }

    const clinicId    = uid();
    const contactName = [first_name, last_name].filter(Boolean).join(' ');
    const name        = businessName || contactName || 'New Inquiry';

    await env.DB.prepare(`
      INSERT INTO clinics (
        id, name, contact_name, contact_email, contact_phone, package,
        status, alignment_tasks, clinic_tasks, follow_ups, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'lead', '[]', '[]', '[]', datetime('now'))
    `).bind(clinicId, name, contactName, email || null, phone || null, pkg || null).run();

    // Route to a package-specific sequence where one exists; everything else
    // falls into the generic website inquiry trigger.
    const PACKAGE_TRIGGERS = { 'Calculator Lead Magnet': 'calculator_lead' };
    const triggerKey = PACKAGE_TRIGGERS[pkg] || 'website_inquiry';

    const { results: seqRows } = await env.DB.prepare(
      "SELECT data FROM sequences WHERE id = 'all'"
    ).all();
    const sequences = seqRows[0]?.data ? JSON.parse(seqRows[0].data) : [];
    const seq = sequences.find(s => s.trigger === triggerKey && s.active);

    if (!seq) {
      return json({ ok: true, clinicId, note: `No active ${triggerKey} sequence found` });
    }

    const templateVars = { first_name, last_name, clinic_name: name, business_name: name, email, phone };

    const now = Date.now();
    const fu = {
      id: uid(),
      seqId: seq.id,
      seqName: seq.name,
      trigger: triggerKey,
      triggeredAt: now,
      status: 'active',
      currentStep: 0,
      totalSteps: seq.steps.length,
      steps: seq.steps.map(s => ({ ...s, sentAt: null, status: 'pending' })),
    };

    // Always send step 0 immediately for form submissions — real-time response is critical
    const step0 = fu.steps[0];
    if (step0) {
      try {
        if (!email) throw new Error('no email on file');
        await sendEmail(email, applyTemplate(step0.subject, templateVars), applyTemplate(step0.body, templateVars), env);
        fu.steps[0] = { ...step0, status: 'sent', sentAt: Date.now() };
        fu.currentStep = 1;
      } catch (err) {
        fu.steps[0] = { ...step0, status: 'failed', sentAt: Date.now(), error: err.message };
      }
    }

    await env.DB.prepare(
      'UPDATE clinics SET follow_ups = ? WHERE id = ?'
    ).bind(JSON.stringify([fu]), clinicId).run();

    return json({ ok: true, clinicId }, 201);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
