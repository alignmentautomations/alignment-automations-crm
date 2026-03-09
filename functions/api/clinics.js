// Cloudflare Pages Function: /functions/api/clinics.js

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM clinics ORDER BY created_at DESC'
    ).all();
    
    // Parse JSON columns
    const clinics = results.map(c => ({
      ...c,
      alignment_tasks: c.alignment_tasks ? JSON.parse(c.alignment_tasks) : [],
      clinic_tasks: c.clinic_tasks ? JSON.parse(c.clinic_tasks) : [],
    }));
    
    return new Response(JSON.stringify(clinics), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const clinic = await request.json();
    
    await env.DB.prepare(`
      INSERT INTO clinics (
        id, name, contact_name, contact_email, contact_phone, 
        website, package, status, start_date, alignment_tasks, 
        clinic_tasks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      clinic.id,
      clinic.name,
      clinic.contact_name || null,
      clinic.contact_email || null,
      clinic.contact_phone || null,
      clinic.website || null,
      clinic.package || null,
      clinic.status || 'lead',
      clinic.start_date || null,
      JSON.stringify(clinic.alignmentTasks || []),
      JSON.stringify(clinic.clinicTasks || [])
    ).run();
    
    return new Response(JSON.stringify(clinic), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
