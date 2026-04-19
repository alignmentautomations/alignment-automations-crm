// Cloudflare Pages Function: /functions/api/webhook/form-inquiry.js
// Called by Google Apps Script when a new form row is added to the sheet.

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

export async function onRequestPost({ request, env }) {
  try {
    // Verify shared secret to prevent unauthorized calls
    const authHeader = request.headers.get('x-webhook-secret');
    if (authHeader !== env.WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { first_name, last_name, clinic_name, email, phone, clinic_type, message } = body;

    if (!email && !phone) {
      return new Response(JSON.stringify({ error: 'email or phone required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create the clinic/lead in D1
    const clinicId = uid();
    const contactName = [first_name, last_name].filter(Boolean).join(' ');
    const name = clinic_name || contactName || 'New Inquiry';

    await env.DB.prepare(`
      INSERT INTO clinics (
        id, name, contact_name, contact_email, contact_phone,
        status, alignment_tasks, clinic_tasks, follow_ups, created_at
      ) VALUES (?, ?, ?, ?, ?, 'lead', '[]', '[]', '[]', datetime('now'))
    `).bind(clinicId, name, contactName, email || null, phone || null).run();

    // Find the active Form Inquiry sequence
    const { results: seqRows } = await env.DB.prepare(
      "SELECT data FROM sequences WHERE id = 'all'"
    ).all();
    const sequences = seqRows[0]?.data ? JSON.parse(seqRows[0].data) : [];
    const seq = sequences.find(s => s.trigger === 'form_inquiry' && s.active);

    if (!seq) {
      return new Response(JSON.stringify({ ok: true, clinicId, note: 'No active form_inquiry sequence found' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build the follow-up entry
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
          await sendEmail(email, step0.subject, step0.body, env);
        } else {
          if (!phone) throw new Error('no phone on file');
          await sendSms(phone, step0.body, env);
        }
        fu.steps[0] = { ...step0, status: 'sent', sentAt: Date.now() };
        fu.currentStep = 1;
      } catch (err) {
        fu.steps[0] = { ...step0, status: 'failed', sentAt: Date.now(), error: err.message };
      }
    }

    // Save follow-up to clinic
    await env.DB.prepare(
      "UPDATE clinics SET follow_ups = ? WHERE id = ?"
    ).bind(JSON.stringify([fu]), clinicId).run();

    return new Response(JSON.stringify({ ok: true, clinicId }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
