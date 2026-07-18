// Cloudflare Pages Function: /functions/api/prospects/export.csv.js
// (Cloudflare Pages Functions strip only the trailing .js — this resolves
// to GET /api/prospects/export.csv.)

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM prospects ORDER BY score DESC, created_at DESC"
    ).all();

    const headers = [
      "Business", "Trade", "Score", "Tier", "Phone", "Email", "Website",
      "Has Website", "Mobile Friendly", "Agency Detected", "Facebook", "Instagram",
      "Twitter/X", "LinkedIn", "Rating", "Reviews",
      "Address", "Google Maps", "Channel", "Leak Flagged", "Date Sent",
      "Watched", "Replied", "Next Follow-up", "Outreach Stage", "Pushed to Pipeline",
    ];

    const rows = results.map((p) => {
      const check = p.website_check ? JSON.parse(p.website_check) : {};
      const social = check.social || {};
      return [
        p.business_name, p.trade, p.score, p.tier, p.phone, p.email, p.website,
        p.website ? "Yes" : "No",
        check.mobileFriendly === true ? "Yes" : check.mobileFriendly === false ? "No" : "",
        check.agencyDetected ? "Yes" : "No",
        social.facebook || "", social.instagram || "", social.twitter || "", social.linkedin || "",
        p.rating ?? "", p.review_count ?? "",
        p.address, p.google_maps_url,
        p.channel || "", p.leak_flagged || "", p.date_sent || "",
        p.watched ? "Yes" : "No", p.replied ? "Yes" : "No",
        p.next_follow_up || "", p.outreach_stage || "",
        p.pushed_clinic_id ? "Yes" : "No",
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=prospects.csv",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
