// Cloudflare Pages Function: /functions/api/prospects/recheck.js
//
// Re-runs checkWebsite against prospects ALREADY in the table, and rewrites
// their website_check, score and tier from the fresh read.
//
// WHY THIS EXISTS. checkWebsite only ever ran inside /api/prospects/search,
// so a fix to the checker did nothing for rows already stored — they kept
// whatever the old code decided, indefinitely. On 2026-09-15 that meant 59
// live rows carrying flags from three separate defects (an unquoted-attribute
// blind spot in the viewport regex, a SiteGround 202 challenge stub read as
// the real page, and a 404 on a path condemning a working domain). Fixing the
// checker without this endpoint would have left the wrong flags sitting in
// front of the next person to screen that batch.
//
// It re-checks websites only. It does not touch Places data, licences, or any
// field a human has edited — no API quota is spent and nothing is re-searched.

import {
  checkWebsite,
  deriveAutoSignals,
  computeScore,
  tierFor,
  runWithConcurrency,
} from "../_lib/prospecting.js";

// Matches search.js. Bounded so a large re-check cannot blow the Worker's
// subrequest ceiling in one request; page through with `limit`/`offset`.
const CONCURRENCY = 4;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : null;
    const limit = Math.min(Number(body.limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Number(body.offset) || 0;
    const dryRun = body.dryRun === true;

    // Only rows that HAVE a website are worth re-checking; a row with no
    // website has nothing for the checker to look at and its flags cannot be
    // wrong in the way this endpoint exists to repair.
    let rows;
    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const res = await env.DB.prepare(
        `SELECT id, business_name, website, website_check, manual_signals, phone, email, score, tier
           FROM prospects
          WHERE id IN (${placeholders}) AND website IS NOT NULL AND website != ''`
      ).bind(...ids).all();
      rows = res.results || [];
    } else {
      const res = await env.DB.prepare(
        `SELECT id, business_name, website, website_check, manual_signals, phone, email, score, tier
           FROM prospects
          WHERE website IS NOT NULL AND website != ''
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`
      ).bind(limit, offset).all();
      rows = res.results || [];
    }

    if (rows.length === 0) {
      return json({ checked: 0, changed: 0, changes: [], remaining: 0 });
    }

    const outcomes = await runWithConcurrency(rows, CONCURRENCY, async (row) => {
      const before = row.website_check ? safeParse(row.website_check) : {};
      const after = await checkWebsite(row.website);

      const manual = row.manual_signals
        ? safeParse(row.manual_signals)
        : { runsAds: false, growthIntent: false, ownerOperated: false };
      const auto = deriveAutoSignals({
        website: row.website,
        websiteCheck: after,
        phone: row.phone,
        email: row.email,
      });
      const score = computeScore({ ...auto, ...manual });
      const tier = tierFor(score).label;

      // Report every field whose MEANING changed, so a run is auditable rather
      // than a count. The three that move because of the 2026-09-15 fixes are
      // named explicitly; scoring is included because a flag flip can retier a
      // row and that is the part that changes what gets worked.
      //
      // ⚠ The defaults below are load-bearing. `challenged` and
      // `listingLinkBroken` did not exist before this change, so a naive
      // `before[key] !== after[key]` reports EVERY row as changed on the first
      // run purely because two new keys appeared as `false`. That would have
      // made the first and most important run's diff useless — 59 of 59
      // "changed" tells you nothing about which flags were actually wrong.
      // An absent field is compared against what its absence meant.
      const ABSENT_MEANT = {
        reachable: null,          // tri-state: absence was "unknown"
        mobileFriendly: null,     // tri-state: absence was "unknown"
        challenged: false,        // new field; not challenged is the old default
        listingLinkBroken: false, // new field; not broken is the old default
        agencyDetected: false,
        statusCode: null,
      };
      const diff = {};
      for (const [key, absentMeant] of Object.entries(ABSENT_MEANT)) {
        const b = before[key] === undefined ? absentMeant : before[key];
        const a = after[key] === undefined ? absentMeant : after[key];
        if (b !== a) diff[key] = { before: b, after: a };
      }
      if (row.score !== score) diff.score = { before: row.score, after: score };
      if (row.tier !== tier) diff.tier = { before: row.tier, after: tier };

      return { row, after, score, tier, diff, changed: Object.keys(diff).length > 0 };
    });

    const changes = outcomes
      .filter((o) => o.changed)
      .map((o) => ({ id: o.row.id, businessName: o.row.business_name, website: o.row.website, diff: o.diff }));

    if (!dryRun) {
      // Only write rows that actually moved. An unchanged row does not need its
      // timestamps disturbed, and a smaller batch is a smaller blast radius if
      // one statement fails.
      const writes = outcomes
        .filter((o) => o.changed)
        .map((o) =>
          env.DB.prepare("UPDATE prospects SET website_check = ?, score = ?, tier = ? WHERE id = ?")
            .bind(JSON.stringify(o.after), o.score, o.tier, o.row.id)
        );
      if (writes.length > 0) await env.DB.batch(writes);
    }

    // What is left after this page, so a caller knows whether to keep going.
    let remaining = 0;
    if (!ids) {
      const { results: countRows } = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM prospects WHERE website IS NOT NULL AND website != ''"
      ).all();
      const total = countRows?.[0]?.n ?? 0;
      remaining = Math.max(0, total - (offset + rows.length));
    }

    return json({
      checked: rows.length,
      changed: changes.length,
      dryRun,
      offset,
      remaining,
      changes,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
