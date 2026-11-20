-- MCP: outside AI agents (Claude, ChatGPT, Cursor, …) read a company's cases and documents
-- with their own models. Off until a company admin turns it on.
ALTER TABLE company ADD COLUMN mcp_enabled INTEGER NOT NULL DEFAULT 0;

-- OAuth clients. 'dcr': registered through Dynamic Client Registration (RFC 7591).
-- 'cimd': a Client ID Metadata Document; client_id is its HTTPS URL and the row caches it.
CREATE TABLE oauth_client (
  client_id      TEXT    PRIMARY KEY,
  kind           TEXT    NOT NULL CHECK (kind IN ('dcr', 'cimd')),
  client_name    TEXT    NOT NULL,
  client_uri     TEXT,
  redirect_uris  TEXT    NOT NULL,          -- JSON array
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  fetched_at     TEXT                       -- when a CIMD document was last fetched
);

-- Authorization codes: single use, a few minutes long, bound to PKCE and the redirect URI.
CREATE TABLE oauth_code (
  code_hash       TEXT    PRIMARY KEY,
  client_id       TEXT    NOT NULL,
  user_id         INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  redirect_uri    TEXT    NOT NULL,
  code_challenge  TEXT    NOT NULL,
  scope           TEXT    NOT NULL,
  expires_at      TEXT    NOT NULL
);

-- One agent connection: an OAuth authorization or a personal access token.
-- Only SHA-256 hashes of tokens are stored.
CREATE TABLE mcp_grant (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id     INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL CHECK (kind IN ('oauth', 'token')),
  client_id      TEXT,                      -- oauth only
  name           TEXT    NOT NULL,          -- client name, or the token's label
  scope          TEXT    NOT NULL,          -- 'read' or 'read write'
  token_hash     TEXT    UNIQUE,            -- personal token
  token_hint     TEXT,                      -- last characters, to tell tokens apart
  refresh_hash   TEXT    UNIQUE,            -- current refresh token (rotated on use)
  expires_at     TEXT,                      -- personal token or refresh token expiry
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at   TEXT
);
CREATE INDEX idx_mcp_grant_company ON mcp_grant(company_id);
CREATE INDEX idx_mcp_grant_user ON mcp_grant(user_id);

-- OAuth access tokens (an hour each).
CREATE TABLE mcp_access_token (
  token_hash  TEXT    PRIMARY KEY,
  grant_id    INTEGER NOT NULL REFERENCES mcp_grant(id) ON DELETE CASCADE,
  expires_at  TEXT    NOT NULL
);
CREATE INDEX idx_mcp_access_grant ON mcp_access_token(grant_id);

-- What agents did: one row per tool call, for the company admin.
CREATE TABLE mcp_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  grant_id    INTEGER,                      -- kept after the grant is revoked
  user_id     INTEGER,
  agent       TEXT    NOT NULL,             -- grant name
  tool        TEXT    NOT NULL,
  target      TEXT,                         -- e.g. "attachment 12" or "case 3"
  ok          INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_mcp_audit_company ON mcp_audit(company_id, created_at);
