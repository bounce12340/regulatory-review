-- eCTD packaging: where each attachment goes in the CTD (node such as 1.1.4 or 3.2.s.4.1)
-- and its leaf title, plus the case's envelope and product details for tw-regional.xml.
ALTER TABLE attachment ADD COLUMN ectd_node TEXT;
ALTER TABLE attachment ADD COLUMN ectd_title TEXT;

CREATE TABLE project_ectd (
  project_id INTEGER PRIMARY KEY REFERENCES project(id),
  data TEXT NOT NULL,
  updated_by INTEGER REFERENCES user(id),
  updated_at TEXT NOT NULL
);
