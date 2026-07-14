-- Migration: Add discovery preferences to settings and update company default status
ALTER TABLE settings ADD COLUMN preferred_industries TEXT DEFAULT '[]';
ALTER TABLE settings ADD COLUMN preferred_company_sizes TEXT DEFAULT '[]';
