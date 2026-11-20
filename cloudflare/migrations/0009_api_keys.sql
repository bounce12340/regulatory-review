-- API keys: a company's own programs (scripts, ERP, automation) call the REST API (/api/*)
-- as one member, with that member's permissions. Off until a company admin turns it on.
ALTER TABLE company ADD COLUMN api_enabled INTEGER NOT NULL DEFAULT 0;

-- Only the SHA-256 of a key is stored; key_hint holds its last characters to tell keys apart.
CREATE TABLE api_key (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  scope         TEXT    NOT NULL CHECK (scope IN ('read', 'read write')),
  key_hash      TEXT    NOT NULL UNIQUE,
  key_hint      TEXT    NOT NULL,
  expires_at    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at  TEXT
);
CREATE INDEX idx_api_key_company ON api_key(company_id);
CREATE INDEX idx_api_key_user ON api_key(user_id);

-- One row per API request made with a key, for the company admin. Kept for a year.
CREATE TABLE api_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  key_id      INTEGER,                      -- kept after the key is revoked
  user_id     INTEGER,
  key_name    TEXT    NOT NULL,
  method      TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  status      INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_api_audit_company ON api_audit(company_id, created_at);
