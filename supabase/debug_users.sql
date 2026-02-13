-- DEBUG USERS SCRIPT
-- Purpose: List all users to see which one was actually created, and check instance_id.
-- Also check if director@demo.com exists and has a profile.

SELECT 
    id, 
    instance_id, 
    email, 
    raw_user_meta_data, 
    created_at, 
    last_sign_in_at
FROM auth.users;

-- Check profiles for these users
SELECT 
    p.id, 
    -- p.email no existe en profiles, esta en auth.users
    p.first_name, 
    p.last_name_paternal, 
    p.role,
    p.tenant_id
FROM public.profiles p;
