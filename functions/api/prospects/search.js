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

// Review count RANKS, it never excludes. Two earlier versions got this wrong in
// opposite directions and both hid real prospects:
//
//   - Originally a ceiling: drop everyone with 40+ reviews as "already
//     established." Backwards against the playbook, which calls active reviews
//     a strong-yes signal ("they have work, so they have money"). It meant
//     plumbers in Santa Maria returned exactly one business, because every shop
//     there carries 50-1,188 reviews.
//   - Then briefly a floor at 10, from the playbook's "fewer than 10 reviews"
//     skip. Same mistake wearing the other hat: it would have hidden the one
//     result the ceiling did return, and Matt's call is that some sub-10
//     businesses still look like good prospects.
//
// The playbook's review guidance is a guideline, not a gate, so it belongs in
// the ordering and not in a filter. Thin-review businesses sort below
// comparable ones and stay on the list, where a person can judge them.
const THIN_REVIEW_COUNT = 10;

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
    // Nothing is excluded on review count. Every business Places returns stays
    // on the list; the ordering decides what makes the cap.
    const results = rawResults.slice();
    const thinReviewCount = results.filter((r) => (r.reviewCount || 0) < THIN_REVIEW_COUNT).length;

    // Rank before the cap, not after. The cap used to slice Google's own
    // ordering, which is roughly by prominence — so the ten slots went to the
    // biggest shops in town and the businesses with actual website problems
    // fell off the bottom. Every signal used here comes back on the Places
    // response already, so ranking costs no extra subrequests. The full score
    // still can't run at this point: it needs the website check, which is the
    // expensive part we're capping in the first place.
    const siteRank = (r) => {
      if (!r.website) return 0;                                   // no site at all: the strongest signal there is
      if (!r.hasHours && !(r.photoCount > 0)) return 1;           // bare/unclaimed GBP
      return 2;                                                   // has a site: worth checking, but last in line
    };
    // Secondary, and deliberately weak: a business with almost no reviews may
    // be dormant, so it sorts below a comparable one with a real review
    // history. It is never removed — see THIN_REVIEW_COUNT above.
    const thinRank = (r) => ((r.reviewCount || 0) < THIN_REVIEW_COUNT ? 1 : 0);
    results.sort((a, b) => siteRank(a) - siteRank(b) || thinRank(a) - thinRank(b));

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

    return new Response(JSON.stringify({ added: prospects.length, skipped, thinReviewCount, subrequestsApprox }), {
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
