// Cloudflare Pages Function: /functions/api/prospects/[id]/push.js
// Pushes a prospect into the sales pipeline as a new `clinics` row — a
// same-database insert now, replacing the standalone local tool's
// cross-app HTTP call to a separate CRM_API_URL.

import { mapProspectToClinic } from "../../_lib/prospecting.js";

export async function onRequestPost({ params, env }) {
  try {
    const { id } = params;
    const { results } = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?").bind(id).all();
    const prospect = results[0];
    if (!prospect) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }

    if (prospect.pushed_clinic_id) {
      return new Response(JSON.stringify({
        error: "Already pushed to the pipeline",
        clinicId: prospect.pushed_clinic_id,
        pushedAt: prospect.pushed_at,
      }), {
        status: 409, headers: { "Content-Type": "application/json" },
      });
    }

    const prospectRow = { ...prospect, website_check: prospect.website_check ? JSON.parse(prospect.website_check) : {} };
    const clinic = mapProspectToClinic(prospectRow);

    await env.DB.prepare(`
      INSERT INTO clinics (
        id, name, contact_name, contact_email, contact_phone,
        website, package, status, start_date,
        alignment_tasks, clinic_tasks, follow_ups,
        industry, source, priority, lead_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      clinic.id, clinic.name,
      null, clinic.contact_email || null, clinic.contact_phone || null,
      clinic.website || null, null, clinic.status,
      null,
      JSON.stringify([]), JSON.stringify([]), JSON.stringify([]),
      clinic.industry, clinic.source, clinic.priority, clinic.lead_note
    ).run();

    const pushedAt = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE prospects SET pushed_clinic_id = ?, pushed_at = ? WHERE id = ?"
    ).bind(clinic.id, pushedAt, id).run();

    return new Response(JSON.stringify({ clinicId: clinic.id, pushedAt }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
