-- Migration: Add separate discovery location to settings
ALTER TABLE settings ADD COLUMN discovery_location TEXT DEFAULT '';
