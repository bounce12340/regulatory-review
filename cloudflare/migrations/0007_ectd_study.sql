-- eCTD Module 4/5: the study an attachment belongs to. Each study becomes a node extension
-- titled with this text (TFDA: Module 4 and 5 reports are given as node extensions).
ALTER TABLE attachment ADD COLUMN ectd_study TEXT;
