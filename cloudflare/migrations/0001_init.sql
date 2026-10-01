-- RegReview schema for Cloudflare D1 (SQLite).
-- Mirrors the original SQLAlchemy models (company / user / project / checklist_item)
-- and adds server-side sessions + a login-attempt log for brute-force protection.

PRAGMA foreign_keys = ON;

CREATE TABLE company (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,
  plan        TEXT    NOT NULL DEFAULT 'basic',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE user (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  full_name     TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login    TEXT
);
CREATE INDEX idx_user_company ON user(company_id);

CREATE TABLE project (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  created_by   INTEGER REFERENCES user(id) ON DELETE SET NULL,
  name         TEXT    NOT NULL,
  slug         TEXT    NOT NULL,
  schema_type  TEXT    NOT NULL DEFAULT 'drug_registration_extension',
  deadline     TEXT,                       -- YYYY-MM-DD
  description  TEXT,
  status       TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (company_id, slug)
);
CREATE INDEX idx_project_company ON project(company_id, status);

CREATE TABLE checklist_item (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  item_key    TEXT,                        -- schema key (item1…) — NULL for custom items
  item_name   TEXT    NOT NULL,
  category    TEXT,
  required    INTEGER NOT NULL DEFAULT 1,
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('completed', 'in_progress', 'under_review', 'blocked', 'pending')),
  risk_level  TEXT    NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  notes       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by  INTEGER REFERENCES user(id) ON DELETE SET NULL
);
CREATE INDEX idx_item_project ON checklist_item(project_id, sort_order);

CREATE TABLE session (
  token_hash  TEXT    PRIMARY KEY,         -- SHA-256 of the cookie token; raw token never stored
  user_id     INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_session_user ON session(user_id);

CREATE TABLE login_attempt (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL,
  ip          TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_login_attempt_email ON login_attempt(email, created_at);
