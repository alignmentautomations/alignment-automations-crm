function delayMs(delay, unit) {
  switch (unit) {
    case 'minutes': return delay * 60 * 1000;
    case 'hours':   return delay * 60 * 60 * 1000;
    case 'days':    return delay * 24 * 60 * 60 * 1000;
    default:        return delay * 60 * 60 * 1000;
  }
}

function applyTemplate(text, clinic) {
  if (!text) return text;
  const firstName = (clinic.contact_name || '').split(' ')[0] || '';
  const lastName  = (clinic.contact_name || '').split(' ').slice(1).join(' ') || '';
  return text
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{clinic_name\}\}/gi, clinic.name || '')
    .replace(/\{\{email\}\}/gi, clinic.contact_email || '')
    .replace(/\{\{phone\}\}/gi, clinic.contact_phone || '');
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

export default {
  async scheduled(event, env, ctx) {
    const { results: clinics } = await env.DB.prepare(
      'SELECT id, name, contact_name, contact_email, contact_phone, follow_ups FROM clinics'
    ).all();

    for (const clinic of clinics) {
      const followUps = clinic.follow_ups ? JSON.parse(clinic.follow_ups) : [];
      let changed = false;

      for (const fu of followUps) {
        if (fu.status !== 'active') continue;

        for (let i = 0; i < fu.steps.length; i++) {
          const step = fu.steps[i];
          if (step.status !== 'pending') continue;

          const prevSentAt = i === 0 ? fu.triggeredAt : fu.steps[i - 1]?.sentAt;
          if (!prevSentAt) break;

          if (Date.now() < prevSentAt + delayMs(step.delay, step.delayUnit)) break;

          try {
            if (step.channel === 'email') {
              if (!clinic.contact_email) throw new Error('no email on file');
              await sendEmail(
                clinic.contact_email,
                applyTemplate(step.subject, clinic),
                applyTemplate(step.body, clinic),
                env
              );
            } else {
              if (!clinic.contact_phone) throw new Error('no phone on file');
              await sendSms(clinic.contact_phone, applyTemplate(step.body, clinic), env);
            }
            fu.steps[i] = { ...step, status: 'sent', sentAt: Date.now() };
            fu.currentStep = i + 1;
          } catch (err) {
            fu.steps[i] = { ...step, status: 'failed', sentAt: Date.now(), error: err.message };
          }
          changed = true;
          break;
        }

        if (fu.steps.every(s => s.status === 'sent' || s.status === 'failed')) {
          fu.status = 'completed';
          changed = true;
        }
      }

      if (changed) {
        await env.DB.prepare(
          'UPDATE clinics SET follow_ups = ? WHERE id = ?'
        ).bind(JSON.stringify(followUps), clinic.id).run();
      }
    }
  },
};
