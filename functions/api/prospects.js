// Cloudflare Pages Function: /functions/api/prospects.js

function parseProspect(p) {
  return {
    ...p,
    website_check: p.website_check ? JSON.parse(p.website_check) : {},
    manual_signals: p.manual_signals ? JSON.parse(p.manual_signals) : { runsAds: false, growthIntent: false, ownerOperated: false },
  };
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM prospects ORDER BY score DESC, created_at DESC"
    ).all();
    return new Response(JSON.stringify(results.map(parseProspect)), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
