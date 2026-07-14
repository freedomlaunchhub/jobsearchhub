CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  job_titles TEXT DEFAULT '[]',
  location TEXT DEFAULT '',
  remote_included INTEGER DEFAULT 1,
  job_sources TEXT DEFAULT '[]',
  daily_target INTEGER DEFAULT 5,
  streak_current INTEGER DEFAULT 0,
  streak_longest INTEGER DEFAULT 0,
  last_active_date TEXT,
  bright_data_api_key TEXT DEFAULT '',
  anthropic_api_key TEXT DEFAULT '',
  preferred_industries TEXT DEFAULT '[]',
  preferred_company_sizes TEXT DEFAULT '[]',
  last_daily_refresh TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT DEFAULT '',
  remote INTEGER DEFAULT 0,
  source TEXT DEFAULT 'linkedin',
  source_url TEXT DEFAULT '',
  posted_date TEXT,
  description TEXT DEFAULT '',
  salary_range TEXT,
  requirements TEXT DEFAULT '[]',
  status TEXT DEFAULT 'new',
  status_history TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  applied_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT DEFAULT '',
  website TEXT DEFAULT '',
  careers_url TEXT DEFAULT '',
  linkedin_url TEXT DEFAULT '',
  size TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'new',
  why_dream TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  contact_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT,
  company_name TEXT DEFAULT '',
  name TEXT NOT NULL,
  title TEXT DEFAULT '',
  linkedin_url TEXT DEFAULT '',
  other_social TEXT DEFAULT '[]',
  rapport_notes TEXT DEFAULT '',
  connection_status TEXT DEFAULT 'identified',
  connection_date TEXT,
  last_contact_date TEXT,
  next_followup_date TEXT,
  message_drafts TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(user_id, company_id);

CREATE TABLE IF NOT EXISTS daily_logs (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  applications_count INTEGER DEFAULT 0,
  connections_sent INTEGER DEFAULT 0,
  followups_done INTEGER DEFAULT 0,
  jobs_reviewed INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
