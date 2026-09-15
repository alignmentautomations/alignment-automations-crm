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
  lookupLicenses,
  phoneDigits,
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
    // `replace` and `excludeContacted` support the county sweep: the browser
    // loops the towns in a county and calls this once per town, so the table
    // must be cleared on the FIRST call only and accumulate after that.
    // Defaults keep a plain single-city search behaving exactly as before.
    const { trade, location, replace = true, excludeContacted = true } = await request.json();
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

    // The service area comes out of the `licenses` table, not a constant --
    // the same source of truth the city list uses, so importing another
    // county's CSLB export widens prospecting automatically with no code
    // change. If the table is empty or the read fails, the set comes back
    // empty and searchContractors skips the filter entirely, which restores
    // the old behaviour rather than silently returning nothing.
    let allowedCounties = new Set();
    try {
      const { results: rows } = await env.DB.prepare(
        "SELECT DISTINCT county FROM licenses WHERE county IS NOT NULL AND county <> ''"
      ).all();
      for (const r of rows || []) allowedCounties.add(String(r.county).trim());
    } catch (e) {
      console.error("service-area lookup failed, filter disabled:", e.message);
    }

    const { results: rawResults, droppedOutOfArea, missingCounty } =
      await searchContractors({ trade, location, apiKey, allowedCounties });
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

    // The prospect list is a per-RUN scratchpad, not an archive. A single-city
    // search is a run of one, so it still clears the table; a county sweep
    // clears on its first town and accumulates across the rest.
    if (replace) await env.DB.prepare("DELETE FROM prospects").run();

    // Two things get filtered out before the expensive website check, because
    // both were producing the "lots of repeat prospects" complaint:
    //
    //   1. place_ids already in the table. Neighbouring towns overlap heavily --
    //      Grover Beach and Arroyo Grande are three miles apart, so Places
    //      returns many of the same businesses for both.
    //   2. businesses already in `clinics`, i.e. already contacted. Those are
    //      not prospects at all. Matched on phone, normalized to ten digits,
    //      because the same business is rarely spelled the same way twice.
    const seen = new Set();
    {
      const { results: rows } = await env.DB.prepare(
        "SELECT place_id FROM prospects WHERE place_id IS NOT NULL"
      ).all();
      for (const r of rows || []) seen.add(r.place_id);
    }
    const contacted = new Set();
    if (excludeContacted) {
      const { results: rows } = await env.DB.prepare(
        "SELECT contact_phone FROM clinics WHERE contact_phone IS NOT NULL"
      ).all();
      for (const r of rows || []) {
        const d = phoneDigits(r.contact_phone);
        if (d.length === 10) contacted.add(d);
      }
    }

    const fresh = results.filter((r) => !seen.has(r.placeId));
    const alreadyListed = results.length - fresh.length;
    const notContacted = fresh.filter((r) => !contacted.has(phoneDigits(r.phone)));
    const alreadyContacted = fresh.length - notContacted.length;

    const newResults = notContacted.slice(0, MAX_RESULTS_PER_SEARCH);
    const skipped = notContacted.length - newResults.length;

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

    // Step 0, done for the whole page in one D1 query. This is a database read,
    // not a fetch, so it adds no Places subrequests and no meaningful latency.
    // It cannot throw — see lookupLicenses — because a licence lookup must
    // never cost a search that has already been paid for.
    const licenses = await lookupLicenses(env.DB, prospects);

    if (prospects.length > 0) {
      const stmt = env.DB.prepare(`
        INSERT OR IGNORE INTO prospects (
          id, place_id, business_name, trade, search_location, address, phone, email,
          website, rating, review_count, business_status, google_maps_url, gbp_status,
          website_check, manual_signals, score, tier, outreach_stage,
          license_no, license_status, license_secondary, license_classes,
          license_expiration, license_bond_cancel, license_name, license_candidates
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      const batch = prospects.map((p) => {
        const lic = licenses.get(p.placeId) || {};
        return stmt.bind(
          p.id, p.placeId, p.businessName, p.trade, p.searchLocation, p.address, p.phone, p.email,
          p.website, p.rating, p.reviewCount, p.businessStatus, p.googleMapsUrl, p.gbpStatus,
          JSON.stringify(p.websiteCheck),
          JSON.stringify({ runsAds: false, growthIntent: false, ownerOperated: false }),
          p.score, p.tier, "New",
          lic.licenseNo ?? null, lic.status ?? "UNMATCHED", lic.secondary ?? null,
          lic.classes ?? null, lic.expiration ?? null, lic.bondCancel ?? null,
          lic.licenseName ?? null, JSON.stringify(lic.candidates || [])
        );
      });
      await env.DB.batch(batch);
    }

    // Rough visibility aid, not exact: 1 Places call + up to 2 fetches per new
    // result (homepage + 1 contact-page fallback if no email found on it).
    const subrequestsApprox = 1 + prospects.length * 2;

    return new Response(JSON.stringify({
      added: prospects.length, skipped, thinReviewCount, subrequestsApprox,
      alreadyListed, alreadyContacted, location,
      droppedOutOfArea, missingCounty,
    }), {
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
