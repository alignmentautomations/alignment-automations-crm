// Cloudflare Pages Function: /functions/api/clinics/[id].js

function parseClinic(c) {
  return {
    ...c,
    alignmentTasks: c.alignment_tasks ? JSON.parse(c.alignment_tasks) : [],
    clinicTasks:    c.clinic_tasks    ? JSON.parse(c.clinic_tasks)    : [],
    followUps:      c.follow_ups      ? JSON.parse(c.follow_ups)      : [],
  };
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
