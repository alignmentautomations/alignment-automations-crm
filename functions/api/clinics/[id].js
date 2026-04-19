// Cloudflare Pages Function: /functions/api/clinics/[id].js

function parseClinic(c) {
  return {
    ...c,
    alignmentTasks: c.alignment_tasks ? JSON.parse(c.alignment_tasks) : [],
    clinicTasks:    c.clinic_tasks    ? JSON.parse(c.clinic_tasks)    : [],
    followUps:      c.follow_ups      ? JSON.parse(c.follow_ups)      : [],
  };
}

function applyTemplate(text, clinic) {
  if (!text) return text;
  const firstName = (clinic.contact_name || '').split(' ')[0] || '';
  const lastName  = (clinic.contact_name || '').split(' ').slice(1).join(' ') || '';
  return text
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi,  lastName)
    .replace(/\{\{clinic_name\}\}/gi, clinic.name || '')
    .replace(/\{\{email\}\}/gi,      clinic.contact_email || '')
    .replace(/\{\{phone\}\}/gi,      clinic.contact_phone || '');
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

export async function onRequestPatch({ params, request, env }) {
  try {
    const { id } = params;
    const patch = await request.json();

    const updates = [];
    const values  = [];

    if (patch.name          !== undefined) { updates.push('name = ?');            values.push(patch.name); }
    if (patch.contact_name  !== undefined) { updates.push('contact_name = ?');    values.push(patch.contact_name); }
    if (patch.contact_email !== undefined) { updates.push('contact_email = ?');   values.push(patch.contact_email); }
    if (patch.contact_phone !== undefined) { updates.push('contact_phone = ?');   values.push(patch.contact_phone); }
    if (patch.website       !== undefined) { updates.push('website = ?');         values.push(patch.website); }
    if (patch.package       !== undefined) { updates.push('package = ?');         values.push(patch.package); }
    if (patch.status        !== undefined) { updates.push('status = ?');          values.push(patch.status); }
    if (patch.start_date    !== undefined) { updates.push('start_date = ?');      values.push(patch.start_date); }
    if (patch.alignmentTasks !== undefined) { updates.push('alignment_tasks = ?'); values.push(JSON.stringify(patch.alignmentTasks)); }
    if (patch.clinicTasks   !== undefined) { updates.push('clinic_tasks = ?');    values.push(JSON.stringify(patch.clinicTasks)); }
    if (patch.followUps     !== undefined) { updates.push('follow_ups = ?');      values.push(JSON.stringify(patch.followUps)); }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.DB.prepare(
      `UPDATE clinics SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values, id).run();

    // Immediately send any step 0s with delay=0 that are still pending
    if (patch.followUps !== undefined) {
      const { results: rows } = await env.DB.prepare(
        'SELECT name, contact_name, contact_email, contact_phone, follow_ups, sms_consent, sms_opted_out FROM clinics WHERE id = ?'
      ).bind(id).all();
      const clinic = rows[0];
      const followUps = clinic.follow_ups ? JSON.parse(clinic.follow_ups) : [];
      let changed = false;

      for (const fu of followUps) {
        if (fu.status !== 'active') continue;
        const step = fu.steps[0];
        if (!step || step.status !== 'pending') continue;
        if (delayMs(step.delay, step.delayUnit) > 0) continue;

        try {
          if (step.channel === 'email') {
            if (!clinic.contact_email) throw new Error('no email on file');
            await sendEmail(clinic.contact_email, applyTemplate(step.subject, clinic), applyTemplate(step.body, clinic), env);
          } else {
            if (!clinic.contact_phone) throw new Error('no phone on file');
            if (!clinic.sms_consent)   throw new Error('no SMS consent on file');
            if (clinic.sms_opted_out)  throw new Error('contact has opted out');
            await sendSms(clinic.contact_phone, applyTemplate(step.body, clinic), env);
          }
          fu.steps[0] = { ...step, status: 'sent', sentAt: Date.now() };
          fu.currentStep = 1;
        } catch (err) {
          fu.steps[0] = { ...step, status: 'failed', sentAt: Date.now(), error: err.message };
        }
        changed = true;
      }

      if (changed) {
        await env.DB.prepare(
          'UPDATE clinics SET follow_ups = ? WHERE id = ?'
        ).bind(JSON.stringify(followUps), id).run();
      }
    }

    const { results } = await env.DB.prepare('SELECT * FROM clinics WHERE id = ?').bind(id).all();
    return new Response(JSON.stringify(parseClinic(results[0])), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    const { id } = params;
    await env.DB.prepare('DELETE FROM clinics WHERE id = ?').bind(id).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
