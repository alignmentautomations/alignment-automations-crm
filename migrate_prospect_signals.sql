-- Prospector signals added 2026-09-16.
--
-- WHY: a full day of screening on 2026-09-16 ended with every candidate
-- disqualified, and NOT ONE of them was killed by something the prospects table
-- could see. Nine businesses were verified by hand to have zero photographs of
-- their own; the stored gbp_status called them Complete, Incomplete and
-- Unclaimed. Reviews five to ten years old were stored identically to reviews
-- from last month. Negranti Construction, a sand and gravel supplier, was
-- indistinguishable from a general contractor.
--
-- All three signals come from the SAME Places Text Search call that was already
-- being made. No extra request, no extra quota.

ALTER TABLE prospects ADD COLUMN primary_type TEXT;
-- Google's own one-line category ("General Contractor", "Suppliers", "Fence
-- contractor"). Deliberately NOT a filter: the 2026-09-14 decision stands, that
-- filtering on Places types would have cut Central Coast Flooring, the best find
-- of that batch, because it is typed "Flooring store". Surface it, never gate on
-- it. Note this is primaryTypeDisplayName, not types[0] — the array leads with
-- "general_contractor" for Negranti while this field correctly says "Suppliers".

ALTER TABLE prospects ADD COLUMN owner_photo_likely INTEGER DEFAULT 0;
-- Count of listing photos attributed to the BUSINESS rather than to a person.
-- A LEAD, NOT A VERDICT: the match compares only the first two normalized name
-- tokens, because the business's Google account name is not always its listing
-- name. Confirm on the listing's "By owner" tab before acting.

ALTER TABLE prospects ADD COLUMN photo_authors TEXT DEFAULT '[]';
-- The distinct photo author names, raw. This is the check on the line above:
-- a list of ordinary people's names means no owner photos, whatever the count
-- says. Kept so the answer is verifiable by eye and never has to be trusted.

ALTER TABLE prospects ADD COLUMN newest_review_sampled TEXT;
-- Date of the newest review IN THE API SAMPLE. Places returns at most five,
-- ordered by its own relevance, and cannot be asked for newest-first — so this
-- is a LOWER BOUND. The true newest can be more recent, never older.

ALTER TABLE prospects ADD COLUMN review_sample_size INTEGER DEFAULT 0;
-- How many reviews that sample contained, stored so the gap against
-- review_count is visible rather than implied.
