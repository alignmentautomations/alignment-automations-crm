CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  place_id TEXT UNIQUE,                 -- Google Places id; dedups repeated searches

  business_name TEXT NOT NULL,
  trade TEXT,                           -- lowercase search key, e.g. "painter" (matches INDUSTRY_MAP)
  search_location TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,                           -- scraped from site if found; user-editable
  website TEXT,
  rating REAL,
  review_count INTEGER,
  business_status TEXT,
  google_maps_url TEXT,

  website_check TEXT DEFAULT '{}',      -- JSON: {attempted, reachable, statusCode, loadTimeMs,
                                         --   mobileFriendly, agencyDetected, builderPlatform, email,
                                         --   social:{facebook,instagram,twitter,linkedin}}
  manual_signals TEXT DEFAULT '{"runsAds":false,"growthIntent":false,"ownerOperated":false}',

  score INTEGER DEFAULT 0,
  tier TEXT,                            -- "Record today" | "Warm" | "Park it"

  channel TEXT,
  leak_flagged TEXT,
  date_sent TEXT,
  watched INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  next_follow_up TEXT,
  outreach_stage TEXT DEFAULT 'New',

  pushed_clinic_id TEXT DEFAULT NULL,   -- set once pushed to the pipeline; NULL = not yet pushed
  pushed_at DATETIME DEFAULT NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
