-- CLEANUP SCRIPT: Run this in the Supabase SQL Editor
-- This will delete all tenant data and all auth users.

BEGIN;

-- Disable triggers to avoid issues during mass deletion
SET session_replication_role = 'replica';

-- 1. Delete all application data (Cascades to profiles, groups, etc.)
TRUNCATE public.tenants CASCADE;

-- 2. Delete all auth users
-- Note: Requires superuser permissions, usually runs fine in Supabase Dashboard
TRUNCATE auth.users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;
