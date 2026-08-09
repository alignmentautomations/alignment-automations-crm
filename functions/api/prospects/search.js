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
  deriveGbpStatus,
  computeScore,
  tierFor,
  runWithConcurrency,
} from "../_lib/prospecting.js";

const MAX_RESULTS_PER_SEARCH = 10;
const CONCURRENCY = 4;

// Google's review count is a strong proxy for "already an established,
// thriving business" — these don't need a lead-gen fix and just crowd out
// the smaller/newer businesses the playbook is actually targeting. Filtered
// out before the website check to also save a subrequest per skip.
const ESTABLISHED_REVIEW_THRESHOLD = 40;

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

    // Defensive trim: a trailing newline/whitespace on the secret (easy to
    // introduce when pasting into a `wrangler pages secret put` prompt)
    // makes Google's edge bounce the request with an empty 400 body, which
    // looks nothing like its usual structured "API key not valid" error —
    // hard to diagnose without this.
    const apiKey = (env.GOOGLE_PLACES_API_KEY || "").trim();
    const rawResults = await searchContractors({ trade, location, apiKey });
    const results = rawResults.filter((r) => (r.reviewCount || 0) < ESTABLISHED_REVIEW_THRESHOLD);
    const establishedSkipped = rawResults.length - results.length;

    // The prospect list is a per-search scratchpad, not an archive: each search
    // replaces the previous list entirely. Anything worth keeping gets pushed
    // to the pipeline (clinics table) before the next search.
    await env.DB.prepare("DELETE FROM prospects").run();

    const newResults = results.slice(0, MAX_RESULTS_PER_SEARCH);
    // With the table cleared, "skipped" now means matches beyond the per-search
    // cap, not duplicates.
    const skipped = results.length - newResults.length;

    const prospects = await runWithConcurrency(newResults, CONCURRENCY, async (result) => {
      const websiteCheck = await checkWebsite(result.website);
      const email = websiteCheck.email || "";
      const auto = deriveAutoSignals({ website: result.website, websiteCheck, phone: result.phone, email });
      const signals = { ...auto, runsAds: false, growthIntent: false, ownerOperated: false };
      const score = computeScore(signals);
      const tier = tierFor(score).label;
      const gbpStatus = deriveGbpStatus({ hasHours: result.hasHours, photoCount: result.photoCount });

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
        gbpStatus,
        websiteCheck,
        score,
        tier,
      };
    });

    if (prospects.length > 0) {
      const stmt = env.DB.prepare(`
        INSERT INTO prospects (
          id, place_id, business_name, trade, search_location, address, phone, email,
          website, rating, review_count, business_status, google_maps_url, gbp_status,
          website_check, manual_signals, score, tier, outreach_stage
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      const batch = prospects.map((p) => stmt.bind(
        p.id, p.placeId, p.businessName, p.trade, p.searchLocation, p.address, p.phone, p.email,
        p.website, p.rating, p.reviewCount, p.businessStatus, p.googleMapsUrl, p.gbpStatus,
        JSON.stringify(p.websiteCheck),
        JSON.stringify({ runsAds: false, growthIntent: false, ownerOperated: false }),
        p.score, p.tier, "New"
      ));
      await env.DB.batch(batch);
    }

    // Rough visibility aid, not exact: 1 Places call + up to 2 fetches per new
    // result (homepage + 1 contact-page fallback if no email found on it).
    const subrequestsApprox = 1 + prospects.length * 2;

    return new Response(JSON.stringify({ added: prospects.length, skipped, establishedSkipped, subrequestsApprox }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("prospects/search failed:", err.code, err.status, err.message);
    // Cloudflare's edge overlays its own generic page for 5xx origin responses,
    // hiding the real error from the client — use 200 with an error field
    // instead so the actual message reaches the frontend for display.
    return new Response(JSON.stringify({ error: err.message, code: err.code }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
}
