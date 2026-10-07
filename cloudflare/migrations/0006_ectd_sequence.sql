-- What each eCTD sequence of a case contained (leaf IDs, sections, operations), so later
-- sequences can replace or delete those documents. Recorded when a sequence is built here,
-- or imported from a ZIP of what was actually submitted.
CREATE TABLE ectd_sequence (
  project_id INTEGER NOT NULL REFERENCES project(id),
  sequence TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('built', 'imported')),
  uuid TEXT,
  leaves TEXT NOT NULL,
  created_by INTEGER REFERENCES user(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, sequence)
);
