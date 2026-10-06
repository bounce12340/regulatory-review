-- Whole-case review: large files arrive in parts, each file carries the text the browser
-- extracted from it, and each checklist item keeps its latest AI review.

-- Text extracted in the browser at upload time, stored in R2 next to the file (r2_key || '.txt').
-- text_status: none (not extracted yet) | ok | scanned (no text layer) | unsupported | failed
ALTER TABLE attachment ADD COLUMN text_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE attachment ADD COLUMN text_chars INTEGER NOT NULL DEFAULT 0;

-- An R2 multipart upload in progress. The id is R2's uploadId; the row ties it to a
-- company, case and item so a client can only add parts to its own upload.
CREATE TABLE upload_session (
  id            TEXT    PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  project_id    INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  item_id       INTEGER NOT NULL REFERENCES checklist_item(id) ON DELETE CASCADE,
  r2_key        TEXT    NOT NULL UNIQUE,
  filename      TEXT    NOT NULL,
  content_type  TEXT    NOT NULL,
  size_bytes    INTEGER NOT NULL,
  part_size     INTEGER NOT NULL,
  created_by    INTEGER REFERENCES user(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_upload_session_project ON upload_session(project_id);

-- Latest AI review of one checklist item against its review thresholds.
-- fingerprint identifies the set of files reviewed, so changed items can be re-run alone.
CREATE TABLE item_review (
  item_id        INTEGER PRIMARY KEY REFERENCES checklist_item(id) ON DELETE CASCADE,
  project_id     INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  verdict        TEXT    NOT NULL CHECK (verdict IN ('pass', 'insufficient', 'revise', 'missing', 'unreadable')),
  summary        TEXT    NOT NULL,
  findings       TEXT    NOT NULL DEFAULT '[]',
  fixes          TEXT    NOT NULL DEFAULT '[]',
  fingerprint    TEXT    NOT NULL,
  model          TEXT,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  reviewed_by    INTEGER REFERENCES user(id) ON DELETE SET NULL,
  reviewed_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_item_review_project ON item_review(project_id);
