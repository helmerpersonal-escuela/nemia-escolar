-- DIAGNOSTIC: Check student and group data for the tutor's children
-- Run this in the Supabase SQL Editor

-- 1. Find children for the tutor
SELECT 
    gu.student_id,
    s.first_name,
    s.last_name_paternal,
    s.group_id,
    g.grade,
    g.section,
    g.tenant_id as group_tenant
FROM public.guardians gu
JOIN public.students s ON s.id = gu.student_id
LEFT JOIN public.groups g ON g.id = s.group_id
WHERE gu.user_id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';

-- 2. If no group is found, check which groups exist in the same tenant
SELECT id, grade, section, tenant_id
FROM public.groups
WHERE tenant_id = 'efc61ce1-32c2-47b6-9751-95becd7ddc33';

-- 3. Check incidents for the tutor's tenant
SELECT count(*) as total_incidents
FROM public.student_incidents
WHERE tenant_id = 'efc61ce1-32c2-47b6-9751-95becd7ddc33';
