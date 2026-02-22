-- FIX: List available groups and assign one to the student
-- Run this in the Supabase SQL Editor

-- 1. List all available groups in this school (tenant)
-- Identify the ID of the group where the student should be
SELECT id, grade, section, tenant_id
FROM public.groups
WHERE tenant_id = 'efc61ce1-32c2-47b6-9751-95becd7ddc33';

-- 2. Check the student's current assignment
SELECT id, first_name, group_id
FROM public.students
WHERE first_name ilike '%Helmer%' AND last_name_paternal ilike '%Ferras%';

-- 3. FIX: Replace GROUP_ID_HERE with the ID from step 1
-- UPDATE public.students 
-- SET group_id = 'GROUP_ID_HERE'
-- WHERE id = (SELECT id FROM public.students WHERE first_name ilike '%Helmer%' AND last_name_paternal ilike '%Ferras%' LIMIT 1);
