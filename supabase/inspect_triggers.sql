-- INSPECT TRIGGERS ON AUTH TABLES
-- Purpose: Find any rogue triggers that might be crashing Supabase Auth logic (500 error on Login).

-- 1. List All Triggers on auth schema tables
SELECT 
    event_object_schema as schema_name,
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
ORDER BY event_object_table, event_manipulation;

-- 2. Check test user details (Did it get created? Does it have weird metadata?)
SELECT 
    id, 
    email, 
    instance_id, 
    role, 
    aud, 
    raw_user_meta_data, 
    created_at, 
    last_sign_in_at
FROM auth.users
WHERE email = 'test@test.com';

-- 3. Check for any hook functions in public schema (common place for custom claims)
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND (p.proname ILIKE '%hook%' OR p.proname ILIKE '%claim%' OR p.proname ILIKE '%jwt%');
