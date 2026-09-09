# -*- coding: utf-8 -*-
"""Turn CSLB's MasterLicenseData.csv into a D1 import for the `licenses` table.

WHY THIS EXISTS
---------------
Step 0 of the spec-build workflow -- verifying a contractor's licence before a
single photo is opened -- was a browser session against cslb.ca.gov per
prospect. CSLB publishes the whole thing as a CSV. Everything Step 0 reads is
in it: status, classifications, expiration, bond cancellation date, workers'
comp dates.

THE MOST IMPORTANT PROPERTY OF THE FILE: it contains ACTIVE LICENCES ONLY.
Verified 2026-09-09 -- All Seasons Heating & Air (797810, expired 07/31/2025)
is absent, while four licences known to be active are all present and match
what was verified by hand. So ABSENCE IS ITSELF THE ANSWER: a licence number
that is not in this table is not active, and the prospect is disqualified.

JOIN KEY IS THE PHONE, normalized to ten digits. Measured on the two counties:
99.9% of active licences carry a usable 10-digit number, and a test against
five builds verified by hand matched 5 for 5. 109 numbers are shared by more
than one licence, so a phone match is a STRONG HINT, NOT A PROOF -- the
importer stores every row and leaves the tie-break to the caller.

THIS IS A SNAPSHOT. It is current to whenever the CSV was downloaded (the
newest row in the 2026-09-09 file was dated 09/08/2026). It goes stale from
that moment. Re-run this whenever a fresh CSV is pulled, and for a borderline
licence on send day still open the live CSLB page -- a second-hand record can
be accurate and still be incomplete.

USAGE
    python tools/build-license-import.py <MasterLicenseData.csv> [out.sql]

Then, from the repo root:
    npx wrangler d1 execute alignment-automations-db --remote --file=out.sql
"""
import csv
import datetime
import io
import os
import re
import sys

# Matt works the Central Coast. Widen this list rather than re-importing the
# whole state: all of California is 243,471 rows, these two counties are ~6,400.
COUNTIES = {"San Luis Obispo", "Santa Barbara"}

DDL = """
DROP TABLE IF EXISTS licenses;
CREATE TABLE licenses (
  license_no        TEXT PRIMARY KEY,
  business_name     TEXT,
  full_name         TEXT,
  city              TEXT,
  county            TEXT,
  zip               TEXT,
  phone_digits      TEXT,        -- normalized 10-digit; THE JOIN KEY
  phone_display     TEXT,
  business_type     TEXT,
  issue_date        TEXT,        -- ISO, so string comparison sorts correctly
  expiration_date   TEXT,
  primary_status    TEXT,        -- 'CLEAR' or a suspension reason
  secondary_status  TEXT,        -- where 'WC Susp Pending' lives. Never ignore.
  classifications   TEXT,        -- pipe-joined, no spaces: 'C20|C43'
  wc_coverage_type  TEXT,
  wc_expiration     TEXT,
  wc_cancellation   TEXT,
  bond_company      TEXT,
  bond_amount       TEXT,
  bond_effective    TEXT,
  bond_cancellation TEXT,        -- the Coastline trap: a future date here means
                                 -- the licence auto-suspends on that day
  last_update       TEXT,
  imported_at       TEXT
);
CREATE INDEX idx_licenses_phone ON licenses(phone_digits);
CREATE INDEX idx_licenses_name  ON licenses(business_name);
CREATE INDEX idx_licenses_city  ON licenses(city);
"""

COLUMNS = [
    "license_no", "business_name", "full_name", "city", "county", "zip",
    "phone_digits", "phone_display", "business_type", "issue_date",
    "expiration_date", "primary_status", "secondary_status", "classifications",
    "wc_coverage_type", "wc_expiration", "wc_cancellation", "bond_company",
    "bond_amount", "bond_effective", "bond_cancellation", "last_update",
    "imported_at",
]


def q(v):
    """SQL string literal. None/'' both become NULL so COALESCE works."""
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def iso(s):
    """CSLB writes MM/DD/YYYY. Store ISO so plain string compares work in SQL."""
    s = (s or "").strip()
    if not s:
        return ""
    try:
        m, d, y = s.split("/")
        return "%04d-%02d-%02d" % (int(y), int(m), int(d))
    except Exception:
        return ""


def digits(s):
    return re.sub(r"\D", "", s or "")


def classes(s):
    """'C20| C43' and 'C-20|C43' both become 'C20|C43'."""
    out = []
    for c in (s or "").split("|"):
        c = c.strip().upper().replace("-", "").replace(" ", "")
        if c:
            out.append(c)
    return "|".join(out)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "licenses-import.sql"
    stamp = datetime.date.today().isoformat()

    kept, skipped_county, skipped_nophone, dup = 0, 0, 0, 0
    seen = set()
    rows_sql = []

    with io.open(src, encoding="utf-8", errors="replace", newline="") as fh:
        for row in csv.DictReader(fh):
            county = (row.get("County") or "").strip()
            if county not in COUNTIES:
                skipped_county += 1
                continue
            lic = (row.get("LicenseNo") or "").strip()
            if not lic:
                continue
            if lic in seen:
                # The export carries one row per licence; a repeat would silently
                # break the PRIMARY KEY, so count it rather than discover it in D1.
                dup += 1
                continue
            seen.add(lic)

            ph = digits(row.get("BusinessPhone"))
            if len(ph) != 10:
                ph = ""
                skipped_nophone += 1

            vals = [
                lic,
                (row.get("BusinessName") or "").strip(),
                (row.get("FullBusinessName") or "").strip(),
                (row.get("City") or "").strip(),
                county,
                (row.get("ZIPCode") or "").strip(),
                ph,
                (row.get("BusinessPhone") or "").strip(),
                (row.get("BusinessType") or "").strip(),
                iso(row.get("IssueDate")),
                iso(row.get("ExpirationDate")),
                (row.get("PrimaryStatus") or "").strip(),
                (row.get("SecondaryStatus") or "").strip(),
                classes(row.get("Classifications(s)")),
                (row.get("WorkersCompCoverageType") or "").strip(),
                iso(row.get("WCExpirationDate")),
                iso(row.get("WCCancellationDate")),
                (row.get("CBSuretyCompany") or "").strip(),
                (row.get("CBAmount") or "").strip(),
                iso(row.get("CBEffectiveDate")),
                iso(row.get("CBCancellationDate")),
                iso(row.get("LastUpdate")),
                stamp,
            ]
            rows_sql.append("(" + ",".join(q(v) for v in vals) + ")")
            kept += 1

    with io.open(out, "w", encoding="utf-8") as fh:
        fh.write("-- Generated by tools/build-license-import.py on %s\n" % stamp)
        fh.write("-- Source: %s\n" % os.path.basename(src))
        fh.write("-- Counties: %s\n" % ", ".join(sorted(COUNTIES)))
        fh.write("-- ACTIVE LICENCES ONLY. A number absent from this table is not active.\n\n")
        fh.write(DDL.strip() + "\n\n")
        # Batched multi-row inserts: one statement per row is ~6,400 round trips
        # through wrangler and takes minutes; 200 to a statement takes seconds.
        BATCH = 200
        for i in range(0, len(rows_sql), BATCH):
            chunk = rows_sql[i:i + BATCH]
            fh.write("INSERT INTO licenses (%s) VALUES\n%s;\n"
                     % (",".join(COLUMNS), ",\n".join(chunk)))

    print("rows written:        %d" % kept)
    print("  no usable phone:   %d" % skipped_nophone)
    print("  duplicate licence: %d" % dup)
    print("skipped, other county: %d" % skipped_county)
    print("output: %s (%.1f MB)" % (out, os.path.getsize(out) / 1048576.0))


if __name__ == "__main__":
    main()
