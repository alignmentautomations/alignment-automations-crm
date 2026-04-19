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
    .replace(/\{\{first_name\}\}/gi, vars.first_name || '')
    .replace(/\{\{last_name\}\}/gi,  vars.last_name  || '')
    .replace(/\{\{clinic_name\}\}/gi, vars.clinic_name || '')
    .replace(/\{\{email\}\}/gi,      vars.email       || '')
    .replace(/\{\{phone\}\}/gi,      vars.phone       || '');
}

async function sendEmail(to, subject, body, env) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [to],
      subject: subject || '(no subject)',
      text: body || '',
    }),
  });
  if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
}

async function sendSms(to, body, env) {
  const digits = to.replace(/\D/g, '');
  const toNumber = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
  const creds = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: env.TWILIO_FROM_NUMBER,
        To: toNumber,
        Body: body || '',
      }).toString(),
    }
  );
  if (!res.ok) throw new Error(`Twilio: ${await res.text()}`);
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
    const { first_name, last_name, clinic_name, email, phone, clinic_type, message, sms_consent, sms_consent_at } = body;

    if (!email && !phone) {
      return json({ error: 'email or phone required' }, 400);
    }

    const clinicId    = uid();
    const contactName = [first_name, last_name].filter(Boolean).join(' ');
    const name        = clinic_name || contactName || 'New Inquiry';
    const consentVal  = sms_consent ? 1 : 0;
    const consentAt   = sms_consent ? (sms_consent_at || new Date().toISOString()) : null;

    await env.DB.prepare(`
      INSERT INTO clinics (
        id, name, contact_name, contact_email, contact_phone,
        status, alignment_tasks, clinic_tasks, follow_ups,
        sms_consent, sms_consent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 'lead', '[]', '[]', '[]', ?, ?, datetime('now'))
    `).bind(clinicId, name, contactName, email || null, phone || null, consentVal, consentAt).run();

    // Find the active Form Inquiry sequence
    const { results: seqRows } = await env.DB.prepare(
      "SELECT data FROM sequences WHERE id = 'all'"
    ).all();
    const sequences = seqRows[0]?.data ? JSON.parse(seqRows[0].data) : [];
    const seq = sequences.find(s => s.trigger === 'form_inquiry' && s.active);

    if (!seq) {
      return json({ ok: true, clinicId, note: 'No active form_inquiry sequence found' });
    }

    const templateVars = { first_name, last_name, clinic_name: name, email, phone };

    const now = Date.now();
    const fu = {
      id: uid(),
      seqId: seq.id,
      seqName: seq.name,
      trigger: 'form_inquiry',
      triggeredAt: now,
      status: 'active',
      currentStep: 0,
      totalSteps: seq.steps.length,
      steps: seq.steps.map(s => ({ ...s, sentAt: null, status: 'pending' })),
    };

    // Immediately send step 0 if delay is 0
    const step0 = fu.steps[0];
    if (step0 && delayMs(step0.delay, step0.delayUnit) === 0) {
      try {
        if (step0.channel === 'email') {
          if (!email) throw new Error('no email on file');
          await sendEmail(email, applyTemplate(step0.subject, templateVars), applyTemplate(step0.body, templateVars), env);
        } else {
          if (!phone) throw new Error('no phone on file');
          if (!sms_consent) throw new Error('no SMS consent on file');
          await sendSms(phone, applyTemplate(step0.body, templateVars), env);
        }
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
