import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'jobsearch.db');

export function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    -- Jobs we've seen
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT,
      url TEXT NOT NULL,
      description TEXT,
      posted_at TEXT,
      discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
      match_score REAL DEFAULT 0,
      status TEXT DEFAULT 'new',
      UNIQUE(company, external_id)
    );

    -- Application pipeline
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER REFERENCES jobs(id),
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'applied',
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      recruiter_name TEXT,
      recruiter_email TEXT,
      follow_up_date TEXT,
      response_date TEXT
    );

    -- Recruiters we've found
    CREATE TABLE IF NOT EXISTS recruiters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      linkedin_url TEXT,
      source TEXT,
      discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company, email)
    );

    -- Company research cache
    CREATE TABLE IF NOT EXISTS company_research (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL UNIQUE,
      funding TEXT,
      employee_count TEXT,
      recent_news TEXT,
      glassdoor_rating TEXT,
      tech_stack TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- People you've messaged (connect notes, InMails, emails)
    CREATE TABLE IF NOT EXISTS outreach (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      person TEXT NOT NULL,
      title TEXT,
      kind TEXT,
      channel TEXT,
      role TEXT,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'sent',
      status_at TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_discovered ON jobs(discovered_at);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_recruiters_company ON recruiters(company);
    CREATE INDEX IF NOT EXISTS idx_outreach_company ON outreach(company);
    CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(status);
  `);

  return db;
}

export function getDb(): Database.Database {
  return initDatabase();
}
