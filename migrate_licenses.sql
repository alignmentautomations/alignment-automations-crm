-- CSLB licence verification. Added 2026-09-09.
--
-- Two parts: the `licenses` table itself (populated by
-- tools/build-license-import.py from CSLB's MasterLicenseData.csv), and the
-- columns on `prospects` that cache what the lookup found at search time.
--
-- The `licenses` DDL lives in the generated import file, because that file
-- drops and recreates the table on every re-import -- a licence export is a
-- snapshot, not an accumulating log, so a clean replace is the correct
-- semantics. This migration only has to add the prospect-side columns.
--
-- WHY CACHE IT ON THE PROSPECT ROW rather than joining on read: the prospects
-- table is wiped and rebuilt by every search, so the cached value is never
-- older than the search that produced it, and a stale licence can never
-- outlive the list it belongs to.

ALTER TABLE prospects ADD COLUMN license_no          TEXT;
ALTER TABLE prospects ADD COLUMN license_status      TEXT;   -- 'CLEAR', a suspension reason,
                                                             -- 'NOT ACTIVE', or 'UNMATCHED'
ALTER TABLE prospects ADD COLUMN license_secondary   TEXT;   -- 'WC Susp Pending' etc.
ALTER TABLE prospects ADD COLUMN license_classes     TEXT;   -- 'C20|C43'
ALTER TABLE prospects ADD COLUMN license_expiration  TEXT;
ALTER TABLE prospects ADD COLUMN license_bond_cancel TEXT;
ALTER TABLE prospects ADD COLUMN license_name        TEXT;   -- the name CSLB holds, which is
                                                             -- often not the trading name
ALTER TABLE prospects ADD COLUMN license_candidates  TEXT DEFAULT '[]';
                                                             -- JSON, only when the phone did not
                                                             -- match: name-similar licences for a
                                                             -- HUMAN to choose from. Never
                                                             -- auto-selected.
