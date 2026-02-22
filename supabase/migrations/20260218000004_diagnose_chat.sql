-- DIAGNOSTIC: Check why teacher can't see the tutor's message
-- Run in Supabase SQL Editor

-- 1. Check tutor and teacher tenant_ids
SELECT id, email, role, tenant_id 
FROM public.profiles 
WHERE id IN (
    'ecd127be-a39c-48a9-8661-e50ffb2248fd',  -- Tutor (helmerferras)
    '85870a47-4730-401d-a96c-a3712e821b3d'   -- Teacher
);

-- 2. Check all chat rooms and their participants
SELECT 
    cr.id as room_id,
    cr.type,
    cr.tenant_id as room_tenant,
    cr.created_at,
    cp.profile_id,
    p.email,
    p.role
FROM public.chat_rooms cr
LEFT JOIN public.chat_participants cp ON cp.room_id = cr.id
LEFT JOIN public.profiles p ON p.id = cp.profile_id
ORDER BY cr.created_at DESC;

-- 3. Check specifically what rooms exist for the teacher
SELECT 
    cr.id,
    cr.type,
    cr.tenant_id,
    cr.created_at
FROM public.chat_rooms cr
INNER JOIN public.chat_participants cp ON cp.room_id = cr.id
WHERE cp.profile_id = '85870a47-4730-401d-a96c-a3712e821b3d';

-- 4. Check messages sent by the tutor
SELECT 
    cm.id,
    cm.room_id,
    cm.content,
    cm.created_at,
    cr.tenant_id as room_tenant
FROM public.chat_messages cm
JOIN public.chat_rooms cr ON cr.id = cm.room_id
WHERE cm.sender_id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd'
ORDER BY cm.created_at DESC
LIMIT 10;
