-- Migration: Add description column to evaluation_criteria
ALTER TABLE evaluation_criteria ADD COLUMN IF NOT EXISTS description TEXT;
