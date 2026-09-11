// Cloudflare Pages Function: /functions/api/prospects/[id]/push.js
// Pushes a prospect into the sales pipeline as a new `clinics` row — a
// same-database insert now, replacing the standalone local tool's
// cross-app HTTP call to a separate CRM_API_URL.

import { mapProspectToClinic, phoneDigits } from "../../_lib/prospecting.js";

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

    // The `pushed_clinic_id` guard above only stops the SAME prospect row being
    // pushed twice. It cannot stop the same BUSINESS arriving as two prospect
    // rows -- Google carries duplicate listings with different place_ids, and
    // the sweep's dedupe is on place_id -- which is how five duplicate clinics
    // rows were created on 2026-09-10. So check the destination table too.
    //
    // This is the same exclusion `search.js` already applies, enforced at the
    // point rows are actually created. It deliberately matches ANY stage:
    // disqualified, declined, sent and won are all "already handled".
    //
    // NOTE: matched on phone only, like the search filter. A business whose
    // listing phone differs from the stored contact_phone will still get
    // through. Name + address matching is the real fix and is not this change.
    const digits = phoneDigits(prospect.phone);
    if (digits.length === 10) {
      const { results: existing } = await env.DB.prepare(
        "SELECT id, name, contact_phone, outreach_stage, status FROM clinics WHERE contact_phone IS NOT NULL"
      ).all();
      const clash = (existing || []).find((c) => phoneDigits(c.contact_phone) === digits);
      if (clash) {
        return new Response(JSON.stringify({
          error: "That business is already in the pipeline",
          clinicId: clash.id,
          name: clash.name,
          outreachStage: clash.outreach_stage,
          status: clash.status,
        }), {
          status: 409, headers: { "Content-Type": "application/json" },
        });
      }
    }

    const prospectRow = { ...prospect, website_check: prospect.website_check ? JSON.parse(prospect.website_check) : {} };
    const clinic = mapProspectToClinic(prospectRow);

    await env.DB.prepare(`
      INSERT INTO clinics (
        id, name, contact_name, contact_email, contact_phone,
        website, package, status, start_date,
        alignment_tasks, clinic_tasks, follow_ups,
        industry, source, priority, lead_note,
        channel, leak_flagged, date_sent, next_follow_up, watched, replied, outreach_stage,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      clinic.id, clinic.name,
      null, clinic.contact_email || null, clinic.contact_phone || null,
      clinic.website || null, null, clinic.status,
      null,
      JSON.stringify([]), JSON.stringify([]), JSON.stringify([]),
      clinic.industry, clinic.source, clinic.priority, clinic.lead_note,
      clinic.channel, clinic.leak_flagged, clinic.date_sent, clinic.next_follow_up,
      clinic.watched, clinic.replied, clinic.outreach_stage
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
