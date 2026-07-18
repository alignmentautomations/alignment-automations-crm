// Cloudflare Pages Function: /functions/api/prospects/search.js
//
// Highest fan-out endpoint in the prospecting feature: one Places API call,
// then a website check per new result. Capped and parallelized (bounded
// concurrency) rather than the local tool's original sequential loop, both
// for speed and to stay well under Cloudflare's per-request subrequest
// ceiling — see MAX_RESULTS_PER_SEARCH and CONCURRENCY below. `subrequestsApprox`
// in the response is a rough visibility aid, not an exact count, worth
// watching during real-world testing against the actual Cloudflare plan.

import {
  searchContractors,
  checkWebsite,
  deriveAutoSignals,
  computeScore,
  tierFor,
  runWithConcurrency,
} from "../_lib/prospecting.js";

const MAX_RESULTS_PER_SEARCH = 10;
const CONCURRENCY = 4;

export async function onRequestPost({ request, env }) {
  try {
    const { trade, location } = await request.json();
    if (!trade || !location) {
      return new Response(JSON.stringify({ error: "trade and location are required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (!env.GOOGLE_PLACES_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing Google Places API key. Set GOOGLE_PLACES_API_KEY as a Pages secret." }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const results = await searchContractors({ trade, location, apiKey: env.GOOGLE_PLACES_API_KEY });

    const { results: existingRows } = await env.DB.prepare("SELECT place_id FROM prospects").all();
    const existingIds = new Set(existingRows.map((r) => r.place_id));

    const newResults = results.filter((r) => !existingIds.has(r.placeId)).slice(0, MAX_RESULTS_PER_SEARCH);
    const skipped = results.length - newResults.length;

    const prospects = await runWithConcurrency(newResults, CONCURRENCY, async (result) => {
      const websiteCheck = await checkWebsite(result.website);
      const email = websiteCheck.email || "";
      const auto = deriveAutoSignals({ website: result.website, websiteCheck, phone: result.phone, email });
      const signals = { ...auto, runsAds: false, growthIntent: false, ownerOperated: false };
      const score = computeScore(signals);
      const tier = tierFor(score).label;

      return {
        id: crypto.randomUUID(),
        placeId: result.placeId,
        businessName: result.businessName,
        trade: trade.toLowerCase(),
        searchLocation: location,
        address: result.address,
        phone: result.phone,
        email,
        website: result.website,
        rating: result.rating,
        reviewCount: result.reviewCount,
        businessStatus: result.businessStatus,
        googleMapsUrl: result.googleMapsUrl,
        websiteCheck,
        score,
        tier,
      };
    });

    if (prospects.length > 0) {
      const stmt = env.DB.prepare(`
        INSERT INTO prospects (
          id, place_id, business_name, trade, search_location, address, phone, email,
          website, rating, review_count, business_status, google_maps_url,
          website_check, manual_signals, score, tier, outreach_stage
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      const batch = prospects.map((p) => stmt.bind(
        p.id, p.placeId, p.businessName, p.trade, p.searchLocation, p.address, p.phone, p.email,
        p.website, p.rating, p.reviewCount, p.businessStatus, p.googleMapsUrl,
        JSON.stringify(p.websiteCheck),
        JSON.stringify({ runsAds: false, growthIntent: false, ownerOperated: false }),
        p.score, p.tier, "New"
      ));
      await env.DB.batch(batch);
    }

    // Rough visibility aid, not exact: 1 Places call + up to 2 fetches per new
    // result (homepage + 1 contact-page fallback if no email found on it).
    const subrequestsApprox = 1 + prospects.length * 2;

    return new Response(JSON.stringify({ added: prospects.length, skipped, subrequestsApprox }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = err.code === "NO_API_KEY" ? 400 : err.code === "PLACES_API_ERROR" ? 502 : 500;
    return new Response(JSON.stringify({ error: err.message }), {
      status, headers: { "Content-Type": "application/json" },
    });
  }
}
