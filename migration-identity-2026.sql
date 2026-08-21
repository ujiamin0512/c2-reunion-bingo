-- ============================================================================
-- Supabase Migration: Update check constraint and migrate Class of 2026
-- Run this in the Supabase SQL Editor
-- ============================================================================

-- 1. Drop the old inline check constraint (default name is participants_identity_check)
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_identity_check;

-- 2. Add the new constraint allowing 'alumni', 'teacher', and 'student'
ALTER TABLE participants ADD CONSTRAINT participants_identity_check CHECK (identity IN ('alumni', 'teacher', 'student'));

-- 3. Migrate: if graduation_year is 2026, change identity from 'alumni' to 'student'
UPDATE participants 
SET identity = 'student' 
WHERE graduation_year = 2026 AND identity = 'alumni';
