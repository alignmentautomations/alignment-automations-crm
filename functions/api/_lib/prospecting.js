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
  "places.addressComponents",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.types",
  "places.regularOpeningHours",
  "places.photos",
  // Added 2026-09-16, after a screening day in which EVERY candidate died on
  // something none of the stored fields could see. All three are on the same
  // Text Search call, so they add no extra request and no extra quota.
  //
  //   primaryTypeDisplayName - Google's own one-line category. `types` leads
  //     with "general_contractor" for a business whose primaryTypeDisplayName
  //     is "Suppliers" (verified on Negranti Construction), so the array is
  //     actively misleading and this field is the honest one.
  //   reviews - carries publishTime. Nothing stored knew how OLD the reviews
  //     were, so a 5.0 from 2016 and a 5.0 from last month were identical.
  "places.primaryTypeDisplayName",
  "places.reviews",
].join(",");

// The business only prospects in the US. Google's Text Search neither
// restricts by country on its own nor honors `regionCode` as a hard filter
// (a bare "London" still returns UK results even with regionCode: "US") — so
// we bias with regionCode AND hard-filter results by the country address
// component, which reliably carries a 2-letter code ("US", "GB", ...).
const SEARCH_COUNTRY = "US";

function componentOf(place, type, field) {
  const c = (place.addressComponents || []).find((a) => (a.types || []).includes(type));
  return c ? c[field] : null;
}

function countryOf(place) {
  return componentOf(place, "country", "shortText");
}

// ─── Service-area filter ───────────────────────────────────────────────────
// ⚠⚠ ADDED 2026-09-14, after a 45-row flooring batch came back 34% junk.
// Places Text Search is a RELEVANCE engine, not a geography filter, and
// `${trade} in ${location}` fails in two distinct ways that both look normal:
//
//   1. TOWN-NAME COLLISIONS. "Santa Margarita, CA" returned four businesses in
//      RANCHO Santa Margarita, 230 miles away in Orange County. "Los Osos"
//      returned Los Banos. "Oceano" returned Oceanside.
//   2. THIN-TOWN FALLBACK. When a small town has few businesses in the trade,
//      Places fills the page from across the state to reach pageSize. "San
//      Miguel, CA" alone returned Fresno, Roseville, Garden Grove, Lakeside,
//      Laguna Niguel, Carmichael and San Diego.
//
// ⚠ The county sweep makes this WORSE, because it deliberately iterates the
// small towns -- which are precisely the ones that produce garbage.
//
// Measured on the run that exposed it: 44 of 131 rows would never have been
// created, saving ~88 website-check subrequests as a side effect.
//
// The allowed counties are NOT hardcoded -- they come from the `licenses`
// table, the same source of truth the city list already uses, so the filter
// widens automatically whenever a new county's CSLB export is imported.
function countyOf(place) {
  // Places spells it "San Luis Obispo County"; CSLB stores "San Luis Obispo".
  const raw = componentOf(place, "administrative_area_level_2", "longText");
  return raw ? raw.replace(/\s+County$/i, "").trim() : null;
}

function stateOf(place) {
  return componentOf(place, "administrative_area_level_1", "shortText");
}

// `allowedCounties`: a Set of county names, or null/empty to disable the
// filter entirely (which restores the old behaviour exactly).
export async function searchContractors({ trade, location, apiKey, allowedCounties = null }) {
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
    body: JSON.stringify({ textQuery, pageSize: 20, regionCode: SEARCH_COUNTRY }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Places API request failed (${res.status} ${res.statusText}): ${body}`);
    err.code = "PLACES_API_ERROR";
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const inCountry = (data.places || []).filter((p) => countryOf(p) === SEARCH_COUNTRY);

  // ⚠ A place with NO county component is KEPT, not dropped, and counted
  // separately. Silently discarding a valid local business because Google
  // omitted a field is the worse failure of the two -- the whole point of this
  // filter is to remove obvious out-of-area noise, not to be clever.
  let droppedOutOfArea = 0;
  let missingCounty = 0;
  const useFilter = allowedCounties && allowedCounties.size > 0;

  const places = inCountry.filter((p) => {
    if (!useFilter) return true;
    const county = countyOf(p);
    if (!county) { missingCounty++; return true; }
    // State is a cheap backstop, because county names repeat across states --
    // there is a Santa Barbara County in California and a Santa Barbara in
    // several other countries' address data. The licence table this list comes
    // from is CSLB, so California is the only state that can ever be right.
    if (stateOf(p) && stateOf(p) !== "CA") { droppedOutOfArea++; return false; }
    if (!allowedCounties.has(county)) { droppedOutOfArea++; return false; }
    return true;
  });

  const mapped = places.map((p) => ({
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
    primaryType: p.primaryTypeDisplayName ? p.primaryTypeDisplayName.text : "",
    hasHours: Boolean(p.regularOpeningHours && p.regularOpeningHours.periods && p.regularOpeningHours.periods.length),
    photoCount: (p.photos || []).length,
    ...summarizePhotos(p.photos, p.displayName ? p.displayName.text : ""),
    ...summarizeReviews(p.reviews),
  }));

  return { results: mapped, droppedOutOfArea, missingCounty };
}

// ─── Photo provenance ─────────────────────────────────────────────────────
//
// ⚠⚠ WHY THIS EXISTS: `photoCount` counts EVERY photo on a listing, Street
// View and customer uploads included. On 2026-09-16, nine businesses were
// verified BY HAND to have zero photographs of their own, and the stored
// gbp_status called them "Complete", "Incomplete" and "Unclaimed / bare" —
// Negranti Construction scored **"Complete" with no owner photos at all**.
// The field was blind to the single thing that disqualified all nine.
//
// ⭐ OWNER PHOTOS ARE THE CHEAPEST AND MOST DECISIVE DISQUALIFIER IN THE MODEL.
// Every page built so far is carried by the client's own photographs, and the
// one build made without any (Paul Cuce #29) was the hardest in the set. This
// is knowable before a minute is spent on Step 0.
//
// The discriminator is `authorAttributions[0].displayName`: an owner upload is
// attributed to the BUSINESS, a customer upload to a person. Verified against
// three known cases — iwerks (2 of 5 by the business), Nagy (10 of 10 by
// individuals), Negranti (3 of 3 by individuals).
//
// ⚠ THE MATCH IS DELIBERATELY CRUDE AND IS LABELLED A LEAD, NOT A VERDICT.
// The business's Google account name is not always its listing name: iwerks
// lists as "iwerks construction and carpentry" and its photos are attributed
// to "iwerks construction and professional han…". An exact match would miss
// it. But the vault's banked rule after three bad matchers is STOP WRITING
// FUZZY NAME MATCHERS, so this compares only the FIRST TWO normalized tokens
// and nothing cleverer — and `photoAuthors` carries the raw names alongside so
// the answer is always checkable by eye. Same discipline as the mobileFriendly
// rename: report what was seen, never a conclusion the data cannot support.
function nameTokens(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

export function summarizePhotos(photos, businessName) {
  const list = photos || [];
  const want = nameTokens(businessName).slice(0, 2);
  const authors = [];
  let ownerLikely = 0;

  for (const ph of list) {
    const a = (ph.authorAttributions || [])[0] || {};
    const name = a.displayName || "";
    if (name && !authors.includes(name)) authors.push(name);
    const got = nameTokens(name).slice(0, 2);
    if (want.length && got.length >= want.length && want.every((t, i) => got[i] === t)) ownerLikely++;
  }
  return {
    photoAuthors: authors,
    ownerPhotoLikely: ownerLikely,   // a LEAD. Confirm on the listing's "By owner" tab.
  };
}

// ─── Review recency ───────────────────────────────────────────────────────
//
// ⚠ THE REVIEWS ARRAY IS A SAMPLE, NOT THE FULL SET. Places returns at most
// five, chosen by its own relevance ordering, and there is no way to ask for
// newest-first. So `newestReview` is a LOWER BOUND: the real newest review can
// be more recent than this and never older. Named accordingly, and
// `reviewSampleSize` is stored beside it so the gap from `reviewCount` is
// visible rather than implied.
//
// Worth it anyway: on iwerks the five returned were all January 2023, within
// five days of each other, which turned "the reviews feel stale" into a dated
// fact and matched a by-hand read of all eight.
export function summarizeReviews(reviews) {
  const list = reviews || [];
  let newest = null;
  for (const r of list) {
    const t = (r.publishTime || "").slice(0, 10);
    if (t && (!newest || t > newest)) newest = t;
  }
  return { newestReviewSampled: newest, reviewSampleSize: list.length };
}

// ─── Google Business Profile completeness ─────────────────────────────────
// Every result here already has a Google Maps listing (that's how Places
// found it) — the actual signal worth flagging is whether the profile looks
// claimed and filled out, or left bare. Hours and photos are the two fields
// an owner has to actively add; their absence together is the strongest
// public proxy we have for "unclaimed or ignored."
// ⚠⚠ READ THIS BEFORE TRUSTING THE RESULT. `photoCount` is EVERY photo on the
// listing, including Street View and customer uploads, so "Complete" here means
// "has hours and has some photos" — it does NOT mean the owner has ever posted
// anything. Negranti Construction scored "Complete" on 2026-09-16 with zero
// photographs of its own. For the question that actually decides a build, use
// `ownerPhotoLikely` / `photoAuthors` from summarizePhotos, not this.
//
// ⚠ It also cannot see whether a listing is CLAIMED. Google does not expose
// that in the Places API at all, so "Unclaimed / bare" is an inference from two
// empty fields and nothing more. R J Potter Construction is genuinely unclaimed
// and scored "Incomplete", understating a real hook. Claimed status stays a
// by-hand check on the listing ("Claim this business" appears only when it is
// unclaimed).
export function deriveGbpStatus({ hasHours, photoCount }) {
  const hasPhotos = (photoCount || 0) > 0;
  if (hasHours && hasPhotos) return "Complete";
  if (!hasHours && !hasPhotos) return "Unclaimed / bare";
  return "Incomplete";
}

// ─── Website check (lib/websiteCheck.js) ───────────────────────────────────

const TIMEOUT_MS = 8000;

// A self-identifying bot string is what WAFs block, and the businesses most
// likely to sit behind Cloudflare or Akamai are the established ones — so the
// old "AlignmentProspector/1.0" UA got refused precisely by the sites least
// likely to actually be broken, and every refusal scored as a defect. Present
// as a normal browser instead.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

// Status codes that mean "we were refused", not "this site is broken". A
// homeowner opening the same URL in a real browser sees a working site.
// Treating these as a defect is the same mistake as reading a 403 from curl as
// "site unreachable" — it put an unrelated business on a spec-build shortlist
// once already. 429 is rate limiting, 401/403 are refusals, 999 is LinkedIn's
// non-standard block code.
const REFUSED_STATUSES = new Set([401, 403, 429, 451, 999]);

// "This exact URL is not here" — worth retrying the origin before condemning
// the whole domain. Distinct from REFUSED_STATUSES, which mean "we were not
// allowed to look", and from 5xx, which means the server itself is unwell.
const NOT_FOUND_STATUSES = new Set([404, 410]);

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
    headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" },
  });
  return { res, html: res.ok ? await res.text() : "" };
}

const EMPTY_SOCIAL = { facebook: null, instagram: null, twitter: null, linkedin: null };

// The viewport tag, matched the way HTML actually gets written.
//
// The previous pattern was /<meta[^>]+name=["']viewport["']/i, which REQUIRES a
// quote straight after `name=`. Unquoted attribute values are perfectly legal
// HTML5, and two competent responsive sites in the 2026-09-15 General Building
// batch serve exactly that:
//
//   <meta name=viewport content="width=device-width, initial-scale=1.0, ...">
//
// Both scored "not mobile-friendly" with the tag sitting right there in their
// markup. `\b` after the word is what keeps `name=viewportx` and
// `name="viewporter"` from matching once the quotes are optional.
const VIEWPORT_META_RE = /<meta[^>]+name\s*=\s*["']?viewport\b/i;

// A bot challenge is not a broken site, even when it answers 2xx.
//
// REFUSED_STATUSES catches the challenges that come back 401/403/429 —
// Cloudflare's, mainly. SiteGround's SGCaptcha does not: it returns **HTTP 202
// with a 166-byte body** whose only content is a meta-refresh to
// /.well-known/sgcaptcha/. `res.ok` is true for 202, so that stub sailed
// through as the real page, had no viewport tag, and manufactured a defect on
// two working sites in the 2026-09-15 batch.
//
// A real browser follows the refresh, clears the challenge and lands on the
// site. We cannot, so the honest answer for anything read off this stub is
// `null` — "could not determine" — never `false`.
const CHALLENGE_MARKERS = [
  /\/\.well-known\/sgcaptcha/i,   // SiteGround
  /cf-browser-verification/i,     // Cloudflare (legacy interstitial)
  /__cf_chl|challenge-platform/i, // Cloudflare (turnstile / managed challenge)
  /_Incapsula_Resource/i,         // Imperva
  /distil_r_captcha|px-captcha/i, // Distil / PerimeterX
];

// Body small enough that there is no real page in it. A genuine homepage,
// however sparse, is far bigger than this; the observed stub was 166 bytes.
const CHALLENGE_MAX_BYTES = 1024;

export function isChallengePage(html) {
  if (!html) return false;
  if (CHALLENGE_MARKERS.some((re) => re.test(html))) return true;
  // A tiny document whose only instruction is "go somewhere else immediately"
  // is an interstitial by construction, whoever served it.
  return html.length <= CHALLENGE_MAX_BYTES && /<meta[^>]+http-equiv\s*=\s*["']?refresh\b/i.test(html);
}

export async function checkWebsite(rawUrl) {
  if (!rawUrl) {
    return { attempted: false, reachable: null, challenged: false, listingLinkBroken: false, mobileFriendly: null, loadTimeMs: null, agencyDetected: false, builderPlatform: null, email: null, social: EMPTY_SOCIAL };
  }

  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    let { res, html } = await fetchHtml(url, controller.signal);

    // A 404 on a PATH says nothing about the domain. Google Places hands back
    // whatever the listing owner typed, and one 2026-09-15 row carried
    // `pasoroblespools.com/gradyspools.com` — a domain pasted on as a path.
    // That 404'd, scored "site unreachable", and the business was one step from
    // a spec build pitched on a dead website that is in fact live and fine.
    //
    // So when a non-root URL 404s, ask the origin. If the origin answers, the
    // site works and the real finding is a different one: their own listing
    // publishes a dead link. That is worth recording, and it is worth handing
    // them for free — but it is NOT a broken website.
    let listingLinkBroken = false;
    if (NOT_FOUND_STATUSES.has(res.status)) {
      let origin = null;
      try {
        const parsed = new URL(url);
        if (parsed.pathname && parsed.pathname !== "/") origin = parsed.origin;
      } catch {
        // unparseable; nothing to retry
      }
      if (origin) {
        try {
          const retry = await fetchHtml(origin, controller.signal);
          if (retry.res.ok) {
            listingLinkBroken = true;
            res = retry.res;
            html = retry.html;
          }
        } catch {
          // Retry failed; keep the original 404 result and say nothing more.
        }
      }
    }

    const loadTimeMs = Date.now() - started;

    let siteHostname = null;
    try {
      siteHostname = new URL(res.url || url).hostname.replace(/^www\./i, "");
    } catch {
      // leave null
    }

    // Anything parsed out of a challenge stub is an artifact of the challenge,
    // not a fact about the site — so the whole read is inconclusive, not just
    // the viewport tag.
    const challenged = isChallengePage(html);

    // Three states, not two. `false` has to mean "we looked and the tag is
    // absent"; with no HTML to look at — or only a challenge stub — the honest
    // answer is `null`. Reporting `false` off an empty body let one refused
    // fetch manufacture a second defect on top of the reachability one.
    //
    // NOTE ON WHAT THIS ACTUALLY MEASURES: the presence of a viewport tag, and
    // nothing more. A site can carry the tag and still overflow horizontally.
    // Treat `false` as "worth checking", not as a verdict — confirm with
    // tools/probe-mobile.py before any of it reaches a prospect.
    const mobileFriendly = (html && !challenged) ? VIEWPORT_META_RE.test(html) : null;
    const agencyDetected = challenged ? false : detectAgency(html, siteHostname);
    const builder = challenged ? null : BUILDER_PATTERNS.find((b) => b.re.test(html));
    const social = challenged ? EMPTY_SOCIAL : extractSocialLinks(html);
    let email = challenged ? null : extractEmail(html);

    if (!email && res.ok && !challenged) {
      email = await findEmailOnContactPages(url);
    }

    return {
      attempted: true,
      // null means "could not determine", never "broken". A refusal proves
      // nothing about whether the site works for a real visitor, and neither
      // does a bot challenge we were never going to clear.
      reachable: challenged ? null : (res.ok ? true : (REFUSED_STATUSES.has(res.status) ? null : false)),
      refused: REFUSED_STATUSES.has(res.status),
      challenged,
      // The site is fine; the URL their own listing publishes is not.
      listingLinkBroken,
      statusCode: res.status,
      loadTimeMs,
      mobileFriendly,
      agencyDetected,
      builderPlatform: builder ? builder.name : null,
      email,
      social,
    };
  } catch (err) {
    // A timeout is our 8-second budget running out, which a slow-but-working
    // site trips routinely — inconclusive, so `null`. A genuine transport
    // failure (DNS miss, refused connection, bad TLS) is real evidence the
    // site is broken for everyone, so that stays `false`.
    const timedOut = err.name === "AbortError";
    return {
      attempted: true,
      reachable: timedOut ? null : false,
      refused: false,
      challenged: false,
      listingLinkBroken: false,
      statusCode: null,
      loadTimeMs: Date.now() - started,
      mobileFriendly: null,
      agencyDetected: false,
      builderPlatform: null,
      email: null,
      social: EMPTY_SOCIAL,
      error: timedOut ? "timeout" : err.message,
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
  // The `=== false` here is load-bearing, not defensive style. checkWebsite
  // reports three states and `null` means "could not determine" — a WAF refusal
  // or a timeout. Loosening either of these to a truthy check would score every
  // bot-blocked site as broken, which is the bug that had well-established
  // businesses coming back "Warm".
  const siteBroken = hasWebsite && websiteCheck && websiteCheck.reachable === false;
  // A missing viewport tag stays a scoring signal — all three true positives in
  // the 2026-09-15 batch had no tag AND real horizontal overflow, so it earns
  // its place. What changed is the CLAIM made about it downstream: see
  // buildLeadNote. The signal is a lead, the verdict comes from probe-mobile.py.
  const noViewportTag = hasWebsite && websiteCheck && websiteCheck.mobileFriendly === false;
  const listingLinkBroken = hasWebsite && websiteCheck && websiteCheck.listingLinkBroken === true;

  const visibleProblem = !hasWebsite || siteBroken || noViewportTag || listingLinkBroken;
  const hasAgency = Boolean(websiteCheck && websiteCheck.agencyDetected);
  const reachable = Boolean(phone || email || hasWebsite);
  const noWayToReach = !phone && !email && !hasWebsite;

  return { visibleProblem, hasAgency, reachable, noWayToReach, inTargetTrade: true };
}

// ─── Prospect -> clinic mapping (lib/crm.js), now a same-DB insert ────────

// ⚠ KEEP IN SYNC with PROSPECT_TRADES and INDUSTRIES in src/App.jsx. The keys
// are the Places query phrases; the values must exist in INDUSTRIES or a pushed
// prospect lands with an industry the CRM's dropdown cannot show. Anything
// unmapped falls through to "Other" rather than throwing -- see mapIndustry.
const INDUSTRY_MAP = {
  painter: "Painting",
  "hvac contractor": "HVAC",
  roofer: "Roofing",
  plumber: "Plumbing",
  electrician: "Electrical",
  landscaper: "Landscaping / Lawn",
  "general contractor": "General Building",
  "home remodeler": "Remodeling",
  "flooring contractor": "Flooring",
  "tile contractor": "Tile & Stone",
  "concrete contractor": "Concrete",
  "cabinet maker": "Cabinetry",
  "masonry contractor": "Masonry",
  "swimming pool contractor": "Pools & Spas",
  "fence contractor": "Fencing",
  "tree service": "Tree Service",
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
    // Say what was measured, not what it implies. This flag is the presence of
    // a viewport meta tag and nothing else; a site can carry one and still
    // overflow. It used to read "not mobile-friendly", which is a verdict the
    // check cannot support — and that wording was one copy-paste away from a
    // letter telling a prospect their working site is broken on phones.
    // Confirm with tools/probe-mobile.py before it goes anywhere near outreach.
    if (check.mobileFriendly === false) bits.push("no mobile viewport tag (verify before pitching)");
    if (check.listingLinkBroken) bits.push("Google listing link 404s (site itself is fine)");
    if (check.agencyDetected) bits.push("already has an agency");
  }
  if (prospectRow.gbp_status === "Unclaimed / bare") bits.push("Google Business Profile unclaimed/bare");
  else if (prospectRow.gbp_status === "Incomplete") bits.push("Google Business Profile incomplete");
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
    // Outreach tracker carries over to the business — this is where all outreach
    // gets tracked once a prospect is pushed to the pipeline.
    channel: prospectRow.channel || null,
    leak_flagged: prospectRow.leak_flagged || null,
    date_sent: prospectRow.date_sent || null,
    next_follow_up: prospectRow.next_follow_up || null,
    watched: prospectRow.watched ? 1 : 0,
    replied: prospectRow.replied ? 1 : 0,
    outreach_stage: prospectRow.outreach_stage || "New",
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

// ─── CSLB licence verification ────────────────────────────────────────────
//
// Step 0 of the spec-build workflow -- confirming a contractor is actually
// licensed -- used to be a browser session against cslb.ca.gov, per prospect,
// before any other work happened. CSLB publishes the whole state as a CSV;
// tools/build-license-import.py loads the Central Coast slice into `licenses`.
//
// THE KEY PROPERTY: that export contains ACTIVE LICENCES ONLY. Verified
// 2026-09-09 against All Seasons Heating & Air (797810, expired 07/31/2025),
// which is absent, while four licences confirmed active by hand are all
// present and match field for field. So a miss is meaningful -- but see the
// warning on phone matching below before treating it as a verdict.
//
// This never throws. A licence lookup failing must never cost Matt a search he
// has already paid Google for, so every path returns a shaped object and the
// caller stores whatever it gets.

const LICENSE_STOPWORDS = new Set([
  "painting", "plumbing", "heating", "air", "conditioning", "and", "the",
  "inc", "llc", "co", "company", "services", "service", "mechanical", "sheet",
  "metal", "professional", "electric", "electrical", "construction", "of",
  "son", "sons", "roofing", "landscaping", "landscape", "contractors",
  "contractor", "general", "hvac",
]);

export function phoneDigits(s) {
  const d = String(s || "").replace(/\D/g, "");
  // Places returns "+1 805-543-1135"; CSLB stores "(805) 543 1135".
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

const EMPTY_LICENSE = {
  licenseNo: null, status: "UNMATCHED", secondary: null, classes: null,
  expiration: null, bondCancel: null, licenseName: null, candidates: [],
};

// One query for the whole result page rather than one per prospect: a search
// returns up to ten businesses and ten separate D1 round trips inside a Pages
// Function is wasteful when a single IN clause does it.
export async function lookupLicenses(db, businesses) {
  const out = new Map();
  for (const b of businesses) out.set(b.placeId, { ...EMPTY_LICENSE });
  if (!db || !businesses.length) return out;

  try {
    const byPhone = new Map();
    for (const b of businesses) {
      const p = phoneDigits(b.phone);
      if (p.length === 10) {
        if (!byPhone.has(p)) byPhone.set(p, []);
        byPhone.get(p).push(b);
      }
    }
    const phones = [...byPhone.keys()];
    if (phones.length) {
      const marks = phones.map(() => "?").join(",");
      const { results } = await db.prepare(
        `SELECT license_no, business_name, phone_digits, primary_status,
                secondary_status, classifications, expiration_date, bond_cancellation
           FROM licenses WHERE phone_digits IN (${marks})`
      ).bind(...phones).all();

      // 109 numbers in these two counties are shared by more than one licence,
      // so a phone hit is a strong hint and not a proof. When a number is
      // ambiguous, report it as unmatched WITH the tied rows as candidates
      // rather than silently picking the first.
      const hits = new Map();
      for (const r of results || []) {
        if (!hits.has(r.phone_digits)) hits.set(r.phone_digits, []);
        hits.get(r.phone_digits).push(r);
      }
      for (const [p, rows] of hits) {
        for (const b of byPhone.get(p) || []) {
          out.set(b.placeId, rows.length === 1
            ? shape(rows[0])
            : { ...EMPTY_LICENSE, status: "AMBIGUOUS", candidates: rows.map(brief) });
        }
      }
    }

    // Anything still unmatched: offer name-similar licences for a person to
    // judge. NOT auto-selected -- a wrong match would mark an unlicensed
    // business as verified, which is the exact error this exists to prevent.
    // Word order is no help: the CRM says "Josh Jensen Painting" and CSLB says
    // "JENSEN JOSH PAINTING".
    for (const b of businesses) {
      const cur = out.get(b.placeId);
      if (cur.licenseNo || cur.candidates.length) continue;
      const words = String(b.businessName || "")
        .split(/[^A-Za-z]+/)
        .filter((w) => w.length > 2 && !LICENSE_STOPWORDS.has(w.toLowerCase()));
      if (!words.length) continue;
      const where = words.map(() => "business_name LIKE ?").join(" OR ");
      const { results } = await db.prepare(
        `SELECT license_no, business_name, city, primary_status, secondary_status,
                classifications, expiration_date
           FROM licenses WHERE ${where} ORDER BY business_name LIMIT 5`
      ).bind(...words.map((w) => `%${w.toUpperCase()}%`)).all();
      out.set(b.placeId, {
        ...EMPTY_LICENSE,
        status: (results || []).length ? "UNMATCHED" : "NOT ACTIVE",
        candidates: (results || []).map(brief),
      });
    }
  } catch (err) {
    // Never let this cost a paid Places search.
    console.error("licence lookup failed:", err && err.message);
  }
  return out;
}

function shape(r) {
  return {
    licenseNo: r.license_no,
    status: r.primary_status || null,
    secondary: r.secondary_status || null,
    classes: r.classifications || null,
    expiration: r.expiration_date || null,
    bondCancel: r.bond_cancellation || null,
    licenseName: r.business_name || null,
    candidates: [],
  };
}

function brief(r) {
  return {
    licenseNo: r.license_no, name: r.business_name, city: r.city || null,
    status: r.primary_status, secondary: r.secondary_status || null,
    classes: r.classifications, expiration: r.expiration_date,
  };
}
