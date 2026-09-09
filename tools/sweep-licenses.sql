-- Licence sweep for every live spec build.
--
--   npx wrangler d1 execute alignment-automations-db --remote --file=tools/sweep-licenses.sql
--
-- Replaces the hand-scheduled "recheck licence NNNNNN on the 13th" reminders in
-- the vault. Those only fire on a date somebody guessed in advance; this reads
-- the whole set every time it is run.
--
-- WHAT IT CATCHES, in the order that matters:
--   1. NOT ACTIVE      -- no row in `licenses`. The CSLB export is active-only,
--                         so a miss is either a dead licence or a bad phone.
--                         Always resolve by NAME before believing it (below).
--   2. SUSPENDED       -- primary_status is anything but CLEAR.
--   3. PENDING         -- secondary_status set, e.g. 'WC Susp Pending'. The
--                         licence is still active TODAY but is queued to be
--                         suspended. This is the one a date-based reminder
--                         misses, because nothing has happened yet.
--   4. BOND CANCELS    -- a future bond cancellation auto-suspends the licence
--                         on that day (the Coastline trap).
--   5. WC EXPIRED      -- workers' comp lapsed.
--   6. EXPIRES SOON    -- licence expiry inside 120 days.
--
-- ⚠ A "NOT ACTIVE" line is NOT proof on its own. The join is on phone, and the
-- phone CSLB holds is often not the one on the Google listing -- Josh Jensen's
-- CSLB number is (805) 286-8023 against (805) 400-5539 on his listing, and
-- Wann Plumbing's CSLB record carries a (804) area code, which is Virginia and
-- is almost certainly CSLB's own typo. Both look identical to a dead licence
-- here. Resolve every miss by name before acting:
--
--   SELECT * FROM licenses WHERE business_name LIKE '%SURNAME%';
--
-- ⚠ And this table is a SNAPSHOT. Re-run tools/build-license-import.py against
-- a fresh CSLB download before trusting it, and for a borderline licence on
-- send day open the live cslb.ca.gov page anyway.

SELECT
  c.name                                        AS build,
  COALESCE(l.license_no, '--')                  AS licence,
  COALESCE(l.primary_status, '--')              AS status,
  TRIM(
    CASE WHEN l.license_no IS NULL
         THEN 'NOT ACTIVE (or phone mismatch - check by name) ' ELSE '' END ||
    CASE WHEN l.primary_status IS NOT NULL AND l.primary_status <> 'CLEAR'
         THEN 'SUSPENDED: ' || l.primary_status || ' ' ELSE '' END ||
    CASE WHEN COALESCE(l.secondary_status, '') <> ''
         THEN 'PENDING: ' || l.secondary_status || ' ' ELSE '' END ||
    CASE WHEN COALESCE(l.bond_cancellation, '') <> ''
         THEN 'BOND CANCELS ' || l.bond_cancellation || ' ' ELSE '' END ||
    CASE WHEN COALESCE(l.wc_expiration, '') <> ''
          AND l.wc_expiration < date('now', '-7 hours')
         THEN 'WC EXPIRED ' || l.wc_expiration || ' ' ELSE '' END ||
    CASE WHEN COALESCE(l.expiration_date, '') <> ''
          AND l.expiration_date < date('now', '-7 hours', '+120 days')
         THEN 'EXPIRES ' || l.expiration_date || ' ' ELSE '' END
  )                                             AS flags
FROM clinics c
LEFT JOIN licenses l
  ON l.phone_digits = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
       COALESCE(c.contact_phone, ''), '+1', ''), '-', ''), ' ', ''), '(', ''), ')', '')
WHERE c.outreach_stage IN ('Sent', 'Watched')
ORDER BY
  CASE WHEN l.license_no IS NULL THEN 0
       WHEN l.primary_status <> 'CLEAR' THEN 1
       WHEN COALESCE(l.secondary_status, '') <> '' THEN 2
       ELSE 3 END,
  c.name;
