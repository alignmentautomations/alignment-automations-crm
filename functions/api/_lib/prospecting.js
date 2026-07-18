// Shared logic for the Prospecting page's Cloudflare Pages Functions. Ported
// from the standalone local prospecting tool (alignment-prospector), kept in
// one shared file (Cloudflare's `_`-prefix-excludes-from-routing convention,
// same mechanism as _middleware.js) rather than duplicated across the
// several route files that need it — this is regex-heavy logic where drift
// across copies would be a real risk.

// ─── Google Places search (lib/places.js) ─────────────────────────────────

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.types",
].join(",");

export async function searchContractors({ trade, location, apiKey }) {
  if (!apiKey) {
    const err = new Error("Missing Google Places API key. Set GOOGLE_PLACES_API_KEY as a Pages secret.");
    err.code = "NO_API_KEY";
    throw err;
  }

  const textQuery = `${trade} in ${location}`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, pageSize: 20 }),
  });

  if (!res.ok) {
    const body = await res.text().catch((e) => `<text() failed: ${e.message}>`);
    const headerDump = [...res.headers.entries()].map(([k, v]) => `${k}=${v}`).join(", ");
    const err = new Error(
      `Places API request failed (${res.status} ${res.statusText}), ` +
      `keyLen=${apiKey.length}, headers=[${headerDump}], body=${JSON.stringify(body)}`
    );
    err.code = "PLACES_API_ERROR";
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const places = data.places || [];

  return places.map((p) => ({
    placeId: p.id,
    businessName: p.displayName ? p.displayName.text : "Unknown",
    address: p.formattedAddress || "",
    phone: p.internationalPhoneNumber || p.nationalPhoneNumber || "",
    website: p.websiteUri || "",
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? 0,
    businessStatus: p.businessStatus || "",
    googleMapsUrl: p.googleMapsUri || "",
    types: p.types || [],
  }));
}

// ─── Website check (lib/websiteCheck.js) ───────────────────────────────────

const TIMEOUT_MS = 8000;

// Phrases that *can* precede an agency credit — but the phrase alone isn't
// enough evidence (see detectAgency below). Deliberately excludes "powered
// by": that phrase is almost always a CMS/plugin credit ("Powered by
// WordPress"), which BUILDER_PATTERNS already captures separately.
const AGENCY_PHRASE = /(designed by|website by|site by|built by|marketing by|developed by)/gi;

// A phrase match only counts as "has an agency" if a link to an outside
// domain appears near it — filters out coincidental phrase matches in
// boilerplate copy or taglines with no credit attached.
const HREF_RE = /<a[^>]+href=["']([^"']+)["']/gi;
const NON_AGENCY_DOMAINS = /(wordpress\.org|wordpress\.com|wix\.com|wixstatic\.com|squarespace\.com|godaddy\.com|elementor\.com|wpbakery\.com|weebly\.com|shopify\.com|google\.com|goo\.gl|facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|pinterest\.com|yelp\.com|schema\.org|w3\.org)$/i;

const BUILDER_PATTERNS = [
  { name: "Wix", re: /wix\.com|wixstatic\.com/i },
  { name: "GoDaddy", re: /godaddy|websitebuilder\.godaddy/i },
  { name: "Squarespace", re: /squarespace\.com/i },
  { name: "WordPress", re: /wp-content|wp-includes/i },
];

// Trimmed from the local tool's 4 candidate paths to 1 — the search endpoint
// runs this per-result across up to MAX_RESULTS_PER_SEARCH prospects, and
// Cloudflare's per-request subrequest ceiling makes every extra fallback
// fetch expensive at that fan-out. "/contact" is the single most common path.
const CONTACT_PATHS = ["/contact"];

// Social platforms worth surfacing for outreach — Facebook and Instagram are
// the two the playbook has DM scripts for (Section 09); Twitter/X and
// LinkedIn are included too since they're free to extract from the same fetch.
const SOCIAL_PLATFORMS = [
  {
    key: "facebook",
    hostRe: /^(www\.)?facebook\.com$/i,
    excludeRe: /(sharer|share\.php|\/plugins\/|\/dialog\/|\/tr\/?(\?|$)|\/login|developers\.facebook|help\.facebook|\/policies|\/legal)/i,
  },
  {
    key: "instagram",
    hostRe: /^(www\.)?instagram\.com$/i,
    excludeRe: /(\/explore|accounts\/login|\/developer|\/about|\/p\/|\/reel\/|\/tv\/)/i,
  },
  {
    key: "twitter",
    hostRe: /^(www\.)?(twitter\.com|x\.com)$/i,
    excludeRe: /(intent|\/share|\/i\/|\/home$)/i,
  },
  {
    key: "linkedin",
    hostRe: /^(www\.)?linkedin\.com$/i,
    excludeRe: /(shareArticle|\/sharing|company\/search|help\.linkedin)/i,
  },
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ASSET_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|eot)$/i;
const NOISE_DOMAINS = /(example\.com|domain\.com|yoursite\.com|sentry\.io|wixpress\.com|schema\.org|w3\.org|godaddy\.com|squarespace\.com|wordpress\.com)$/i;

function stripNoise(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
}

function detectAgency(html, siteHostname) {
  const cleaned = stripNoise(html);
  const phraseRe = new RegExp(AGENCY_PHRASE.source, "gi");
  let match;
  while ((match = phraseRe.exec(cleaned))) {
    const start = Math.max(0, match.index - 250);
    const end = Math.min(cleaned.length, match.index + 250);
    const window = cleaned.slice(start, end);
    const hrefRe = new RegExp(HREF_RE.source, "gi");
    let hrefMatch;
    while ((hrefMatch = hrefRe.exec(window))) {
      const href = hrefMatch[1];
      if (!/^https?:\/\//i.test(href)) continue;
      let host;
      try {
        host = new URL(href).hostname.replace(/^www\./i, "");
      } catch {
        continue;
      }
      if (siteHostname && host === siteHostname) continue;
      if (NON_AGENCY_DOMAINS.test(host)) continue;
      return true;
    }
  }
  return false;
}

function extractEmail(html) {
  if (!html) return null;
  const cleaned = stripNoise(html);

  const mailtoMatch = cleaned.match(/mailto:([^"'?\s>]+)/i);
  if (mailtoMatch && mailtoMatch[1]) {
    const addr = mailtoMatch[1].trim();
    const isNoise = ASSET_EXTENSIONS.test(addr) || NOISE_DOMAINS.test(addr.split("@")[1] || "");
    if (!isNoise) return addr;
  }

  const matches = cleaned.match(EMAIL_REGEX) || [];
  const candidate = matches.find((m) => !ASSET_EXTENSIONS.test(m) && !NOISE_DOMAINS.test(m.split("@")[1] || ""));
  return candidate || null;
}

function extractSocialLinks(html) {
  const cleaned = stripNoise(html);
  const hrefRe = new RegExp(HREF_RE.source, "gi");
  const found = {};
  let match;
  while ((match = hrefRe.exec(cleaned))) {
    const href = match[1];
    if (!/^https?:\/\//i.test(href)) continue;
    let parsed;
    try {
      parsed = new URL(href);
    } catch {
      continue;
    }
    for (const platform of SOCIAL_PLATFORMS) {
      if (found[platform.key]) continue;
      if (!platform.hostRe.test(parsed.hostname)) continue;
      if (platform.excludeRe.test(href)) continue;
      if (parsed.pathname === "/" || parsed.pathname === "") continue;
      found[platform.key] = href;
    }
  }
  return {
    facebook: found.facebook || null,
    instagram: found.instagram || null,
    twitter: found.twitter || null,
    linkedin: found.linkedin || null,
  };
}

async function fetchHtml(url, signal) {
  const res = await fetch(url, {
    signal,
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlignmentProspector/1.0)" },
  });
  return { res, html: res.ok ? await res.text() : "" };
}

const EMPTY_SOCIAL = { facebook: null, instagram: null, twitter: null, linkedin: null };

export async function checkWebsite(rawUrl) {
  if (!rawUrl) {
    return { attempted: false, reachable: null, mobileFriendly: null, loadTimeMs: null, agencyDetected: false, builderPlatform: null, email: null, social: EMPTY_SOCIAL };
  }

  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const { res, html } = await fetchHtml(url, controller.signal);
    const loadTimeMs = Date.now() - started;

    let siteHostname = null;
    try {
      siteHostname = new URL(res.url || url).hostname.replace(/^www\./i, "");
    } catch {
      // leave null
    }

    const mobileFriendly = /<meta[^>]+name=["']viewport["']/i.test(html);
    const agencyDetected = detectAgency(html, siteHostname);
    const builder = BUILDER_PATTERNS.find((b) => b.re.test(html));
    const social = extractSocialLinks(html);
    let email = extractEmail(html);

    if (!email && res.ok) {
      email = await findEmailOnContactPages(url);
    }

    return {
      attempted: true,
      reachable: res.ok,
      statusCode: res.status,
      loadTimeMs,
      mobileFriendly,
      agencyDetected,
      builderPlatform: builder ? builder.name : null,
      email,
      social,
    };
  } catch (err) {
    return {
      attempted: true,
      reachable: false,
      statusCode: null,
      loadTimeMs: Date.now() - started,
      mobileFriendly: null,
      agencyDetected: false,
      builderPlatform: null,
      email: null,
      social: EMPTY_SOCIAL,
      error: err.name === "AbortError" ? "timeout" : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function findEmailOnContactPages(baseUrl) {
  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }

  for (const path of CONTACT_PATHS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const { html } = await fetchHtml(origin + path, controller.signal);
      const email = extractEmail(html);
      if (email) return email;
    } catch {
      // ignore and try the next path
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// ─── Scoring (lib/scoring.js) — playbook Section 3 weighted scorecard ─────

export const WEIGHTS = {
  visibleProblem: 3,
  runsAds: 3,
  growthIntent: 2,
  ownerOperated: 2,
  reachable: 1,
  inTargetTrade: 1,
  noWayToReach: -2,
  hasAgency: -3,
};

export const TIERS = [
  { min: 8, label: "Record today", className: "tier-hot" },
  { min: 5, label: "Warm", className: "tier-warm" },
  { min: -Infinity, label: "Park it", className: "tier-cold" },
];

export function computeScore(signals) {
  let score = 0;
  for (const key of Object.keys(WEIGHTS)) {
    if (signals[key]) score += WEIGHTS[key];
  }
  return score;
}

export function tierFor(score) {
  return TIERS.find((t) => score >= t.min);
}

export function deriveAutoSignals({ website, websiteCheck, phone, email }) {
  const hasWebsite = Boolean(website);
  const siteBroken = hasWebsite && websiteCheck && websiteCheck.reachable === false;
  const notMobileFriendly = hasWebsite && websiteCheck && websiteCheck.mobileFriendly === false;

  const visibleProblem = !hasWebsite || siteBroken || notMobileFriendly;
  const hasAgency = Boolean(websiteCheck && websiteCheck.agencyDetected);
  const reachable = Boolean(phone || email || hasWebsite);
  const noWayToReach = !phone && !email && !hasWebsite;

  return { visibleProblem, hasAgency, reachable, noWayToReach, inTargetTrade: true };
}

// ─── Prospect -> clinic mapping (lib/crm.js), now a same-DB insert ────────

const INDUSTRY_MAP = {
  painter: "Painting",
  "hvac contractor": "HVAC",
  roofer: "Roofing",
  plumber: "Plumbing",
  electrician: "Electrical",
  landscaper: "Landscaping / Lawn",
};

const PRIORITY_MAP = {
  "Record today": "hot",
  Warm: "warm",
  "Park it": "cold",
};

export function mapIndustry(trade) {
  return INDUSTRY_MAP[(trade || "").toLowerCase()] || "Other";
}

// prospectRow is a D1 row with website_check already JSON.parse'd.
export function buildLeadNote(prospectRow) {
  if (prospectRow.leak_flagged) return prospectRow.leak_flagged;

  const check = prospectRow.website_check || {};
  const bits = [];
  if (!prospectRow.website) bits.push("No website");
  else {
    if (check.reachable === false) bits.push("site unreachable");
    if (check.mobileFriendly === false) bits.push("not mobile-friendly");
    if (check.agencyDetected) bits.push("already has an agency");
  }
  return bits.length ? bits.join("; ") : "";
}

// prospectRow: a D1 row from `prospects`, with website_check already parsed.
export function mapProspectToClinic(prospectRow) {
  return {
    id: crypto.randomUUID(),
    name: prospectRow.business_name,
    contact_email: prospectRow.email || "",
    contact_phone: prospectRow.phone || "",
    website: prospectRow.website || "",
    status: "lead",
    industry: mapIndustry(prospectRow.trade),
    source: "Google Maps",
    priority: PRIORITY_MAP[prospectRow.tier] || "cold",
    lead_note: buildLeadNote(prospectRow),
  };
}

// ─── Bounded-concurrency helper for the search endpoint ───────────────────
// Runs `fn` over `items` with at most `limit` in flight at once — faster
// than the local tool's original sequential loop, while still capping how
// many fetches fire at once (both to be a reasonable network citizen and to
// help keep subrequest fan-out predictable — see search.js).
export async function runWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
