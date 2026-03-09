CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  package TEXT,
  status TEXT DEFAULT 'lead',
  start_date TEXT,
  alignment_tasks TEXT DEFAULT '[]',
  clinic_tasks TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
