-- A company's own AI service ("bring your own key"). Without a row the company uses the
-- system's AI service (OLLAMA_API_KEY), if one is set up.
CREATE TABLE company_ai (
  company_id  INTEGER PRIMARY KEY REFERENCES company(id) ON DELETE CASCADE,
  provider    TEXT    NOT NULL CHECK (provider IN ('anthropic', 'openai', 'gemini', 'ollama', 'openai_compatible')),
  base_url    TEXT,                         -- null: the provider's default endpoint
  model       TEXT    NOT NULL,
  key_sealed  TEXT    NOT NULL,             -- AES-GCM under AI_KEY_SECRET, bound to the company
  key_hint    TEXT    NOT NULL,             -- last characters, to tell keys apart
  updated_by  INTEGER,
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
