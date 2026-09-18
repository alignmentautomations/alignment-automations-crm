// Cloudflare Pages Function: /functions/api/prospects.js

function parseProspect(p) {
  return {
    ...p,
    website_check: p.website_check ? JSON.parse(p.website_check) : {},
    manual_signals: p.manual_signals ? JSON.parse(p.manual_signals) : { runsAds: false, growthIntent: false, ownerOperated: false },
    // ⚠ photo_authors is stored as a JSON STRING and search.js always writes one
    // (JSON.stringify([]) for a listing with no photos), so it is never null.
    // Omitting it here shipped a raw '[]' to the UI, which called .join() on a
    // string and took the whole Prospector page white on EVERY row — '[]' is
    // truthy and has length 2, so even an empty list hit the crashing branch.
    // Added 2026-09-18. Any new JSON column must be parsed here as well.
    photo_authors: parseJsonArray(p.photo_authors),
  };
}

function parseJsonArray(s) {
  if (Array.isArray(s)) return s;
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
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
