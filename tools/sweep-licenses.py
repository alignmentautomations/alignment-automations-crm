# -*- coding: utf-8 -*-
"""Run tools/sweep-licenses.sql and print it as a table.

WHY A RUNNER AND NOT JUST THE .sql FILE:
`wrangler d1 execute --file=...` takes the IMPORT path. It uploads the file and
runs it as a migration, and it does NOT return rows -- a SELECT through --file
prints "Starting import" and nothing useful. Only `--command` returns a result
set. So the query lives in the .sql file (readable, commented, diffable) and
this reads it, strips the comments, and passes it as --command.

    python tools/sweep-licenses.py

Exit code is 1 if anything is flagged, so it can gate a scheduled task.
"""
import io
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SQL = os.path.join(HERE, "sweep-licenses.sql")
DB = "alignment-automations-db"


def load_query():
    text = io.open(SQL, encoding="utf-8").read()
    # Drop full-line comments; keep the statement itself on one line so it
    # survives being passed as a single --command argument.
    lines = [ln for ln in text.splitlines() if not ln.strip().startswith("--")]
    return " ".join(" ".join(lines).split())


STOPWORDS = {
    "painting", "plumbing", "heating", "air", "conditioning", "and", "the",
    "inc", "llc", "co", "company", "services", "service", "mechanical",
    "sheet", "metal", "professional", "electric", "electrical", "construction",
    "&", "of", "son", "sons",
}


def d1(query):
    proc = subprocess.run(
        ["npx", "wrangler", "d1", "execute", DB, "--remote", "--json", "--command", query],
        capture_output=True, text=True, shell=(os.name == "nt"),
        cwd=os.path.dirname(HERE),
    )
    out = proc.stdout or ""
    try:
        payload = out[out.index("["):out.rindex("]") + 1]
        return json.loads(payload)[0]["results"]
    except Exception:
        return None


def candidates(build_name):
    """Licences whose name shares a distinctive word with the build's name.

    Deliberately NOT a fuzzy auto-match. A wrong match here would report a live
    page as compliant when it is not, which is the one error this tool exists to
    prevent -- so it offers candidates and lets a person decide. Word order is
    no help either: the CRM says "Josh Jensen Painting" and CSLB says
    "JENSEN JOSH PAINTING".
    """
    words = [w for w in re.split(r"[^A-Za-z]+", build_name or "")
             if len(w) > 2 and w.lower() not in STOPWORDS]
    if not words:
        return []
    clauses = " OR ".join(
        "business_name LIKE '%%%s%%'" % w.upper().replace("'", "''") for w in words)
    rows = d1(
        "SELECT license_no, business_name, city, primary_status, "
        "COALESCE(secondary_status,'') sec, classifications, expiration_date "
        "FROM licenses WHERE %s ORDER BY business_name LIMIT 8;" % clauses)
    return rows or []


def main():
    q = load_query()
    proc = subprocess.run(
        ["npx", "wrangler", "d1", "execute", DB, "--remote", "--json", "--command", q],
        capture_output=True, text=True, shell=(os.name == "nt"),
        cwd=os.path.dirname(HERE),
    )
    out = proc.stdout or ""
    try:
        payload = out[out.index("["):out.rindex("]") + 1]
        rows = json.loads(payload)[0]["results"]
    except Exception:
        sys.stderr.write("could not parse wrangler output:\n" + out[-2000:] +
                         "\n" + (proc.stderr or "")[-2000:] + "\n")
        return 2

    flagged = [r for r in rows if (r.get("flags") or "").strip()]
    print("%-34s %-9s %-8s %s" % ("build", "licence", "status", "flags"))
    print("-" * 112)
    for r in rows:
        print("%-34s %-9s %-8s %s" % (
            (r.get("build") or "")[:34], r.get("licence") or "--",
            r.get("status") or "--", (r.get("flags") or "").strip() or "ok"))
    print("\n%d live builds swept, %d flagged." % (len(rows), len(flagged)))

    unmatched = [r for r in rows if not (r.get("licence") or "").strip("-")]
    if unmatched:
        print("\n" + "=" * 112)
        print("PHONE DID NOT MATCH for %d build(s). Candidates by name, in the two"
              " counties." % len(unmatched))
        print("These are CANDIDATES, NOT a verdict -- the tool will not silently")
        print("stamp a licence onto a business. Confirm the city and trade, then")
        print("open cslb.ca.gov if anything is borderline.")
        print("=" * 112)
        for r in unmatched:
            print("\n  %s" % r.get("build"))
            for cand in candidates(r.get("build") or ""):
                print("    %-9s %-32s %-14s %-8s %-8s exp %s%s" % (
                    cand["license_no"], cand["business_name"][:32], cand["city"][:14],
                    cand["primary_status"], cand["classifications"],
                    cand["expiration_date"],
                    "  PENDING: " + cand["sec"] if cand["sec"] else ""))
    return 1 if flagged else 0


if __name__ == "__main__":
    sys.exit(main())
