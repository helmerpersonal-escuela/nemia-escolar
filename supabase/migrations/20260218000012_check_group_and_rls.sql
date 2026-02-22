-- DIAGNOSTIC: Check specific group and RLS
-- Run in Supabase SQL Editor

-- 1. Check the group data for the ID found
SELECT id, grade, section, tenant_id, created_at
FROM public.groups
WHERE id = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';

-- 2. Check if the current user (tutor) can see this group
-- Run this as the authenticated user (tutor)
SELECT id, grade, section
FROM public.groups
WHERE id = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';

-- 3. Check RLS policies for 'groups' table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'groups';
