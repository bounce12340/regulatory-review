-- Files attached to checklist items. The bytes live in R2 (binding FILES) under r2_key;
-- this table holds the metadata and is what tenant checks run against.
CREATE TABLE attachment (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  project_id    INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  item_id       INTEGER NOT NULL REFERENCES checklist_item(id) ON DELETE CASCADE,
  r2_key        TEXT    NOT NULL UNIQUE,
  filename      TEXT    NOT NULL,
  content_type  TEXT    NOT NULL,
  size_bytes    INTEGER NOT NULL,
  uploaded_by   INTEGER REFERENCES user(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_attachment_item ON attachment(item_id);
CREATE INDEX idx_attachment_project ON attachment(project_id);
