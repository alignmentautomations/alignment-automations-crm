// Cloudflare Pages Function: GET /api/prospects/cities?county=San%20Luis%20Obispo
//
// Returns the towns in a county, ranked by how many licensed contractors are
// actually in each, so the Prospecting page can sweep a whole county instead of
// making Matt type "Paso Robles", then "Atascadero", then "Morro Bay", and so on
// down a list he has to remember.
//
// THE CITY LIST IS NOT HARDCODED. It comes out of the `licenses` table -- the
// CSLB master export loaded by tools/build-license-import.py -- so it is the
// state's own list of where licensed contractors are, and it updates whenever
// that file is re-imported. Nobody has to maintain a list of towns.
//
// WHY IT IS RANKED AND THRESHOLDED: San Luis Obispo county has 23 distinct city
// strings, and the tail is worthless for prospecting --
//     Paso Robles 611 ... Pismo Beach 125, Cambria 92, Oceano 68 ...
//     ... Shandon 6, San Simeon 2, Cholame 1, Harmony 1.
// A Places search costs the same whether it is Paso Robles or Harmony
// (population well under a hundred), so the tail is dropped by default. `min`
// overrides the threshold and `all=1` disables it.
//
// ⚠ CSLB's own data carries stale aliases -- "GROVER CITY" is the old name of
// Grover Beach and appears with 2 licences. The threshold removes those as a
// side effect, which is most of why it exists at all.

const DEFAULT_MIN = 10;

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const county = (url.searchParams.get("county") || "").trim();
    const all = url.searchParams.get("all") === "1";
    const min = all ? 0 : Number(url.searchParams.get("min") || DEFAULT_MIN);

    if (!county) {
      // No county given: list what the licence table actually holds, so the UI
      // never offers a county with no data behind it.
      const { results } = await env.DB.prepare(
        `SELECT county, COUNT(DISTINCT city) AS cities, COUNT(*) AS licences
           FROM licenses WHERE county IS NOT NULL AND county <> ''
          GROUP BY county ORDER BY county`
      ).all();
      return json({ counties: results || [] });
    }

    const { results } = await env.DB.prepare(
      `SELECT city, COUNT(*) AS licences
         FROM licenses
        WHERE county = ? AND city IS NOT NULL AND city <> ''
        GROUP BY city
       HAVING COUNT(*) >= ?
        ORDER BY COUNT(*) DESC`
    ).bind(county, min).all();

    // CSLB stores cities in caps. Title-case them for the Places query and for
    // display -- "PASO ROBLES" is not what anyone types into a search box.
    const cities = (results || []).map((r) => ({
      city: titleCase(r.city),
      licences: r.licences,
    }));

    return json({ county, min, cities });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
