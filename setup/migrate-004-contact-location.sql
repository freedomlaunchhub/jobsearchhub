-- Adds contact location (city/region from the LinkedIn profile)
ALTER TABLE contacts ADD COLUMN location TEXT DEFAULT '';
