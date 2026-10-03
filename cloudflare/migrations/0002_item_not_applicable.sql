-- Allow the「不適用」(not_applicable) item status used by TFDA RTF checklists.
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt and its rows copied over.
-- Nothing references checklist_item, so dropping it does not touch other tables.
PRAGMA defer_foreign_keys = true;

CREATE TABLE checklist_item_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  item_key    TEXT,                        -- schema key (item1…) — NULL for custom items
  item_name   TEXT    NOT NULL,
  category    TEXT,
  required    INTEGER NOT NULL DEFAULT 1,
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('completed', 'in_progress', 'under_review', 'blocked', 'pending', 'not_applicable')),
  risk_level  TEXT    NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  notes       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by  INTEGER REFERENCES user(id) ON DELETE SET NULL
);

INSERT INTO checklist_item_new
  (id, project_id, item_key, item_name, category, required, status, risk_level, notes, sort_order, updated_at, updated_by)
SELECT id, project_id, item_key, item_name, category, required, status, risk_level, notes, sort_order, updated_at, updated_by
FROM checklist_item;

DROP TABLE checklist_item;
ALTER TABLE checklist_item_new RENAME TO checklist_item;
CREATE INDEX idx_item_project ON checklist_item(project_id, sort_order);
