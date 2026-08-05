-- Rate-limiting ledger for the public form endpoint (functions/api/webhook/form-inquiry.js).
-- One row per accepted submission; `emailed` marks the ones that triggered an auto-reply.
-- Rows older than 7 days are pruned by the endpoint itself.
--
-- Apply with:
--   wrangler d1 execute alignment-automations-db --remote --file migrate_form_rate_limit.sql

CREATE TABLE IF NOT EXISTS form_submissions (
  id         TEXT PRIMARY KEY,
  ip         TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  emailed    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_ip_time ON form_submissions(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_emailed ON form_submissions(emailed, created_at);
