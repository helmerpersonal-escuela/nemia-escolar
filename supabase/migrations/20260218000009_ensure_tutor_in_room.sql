-- Diagnose: which rooms is the tutor participating in, and what messages exist there
-- Run in Supabase SQL Editor

-- 1. All rooms where tutor is participant
SELECT 
    cp.room_id,
    cr.type,
    cr.created_at as room_created,
    COUNT(cm.id) as message_count
FROM public.chat_participants cp
JOIN public.chat_rooms cr ON cr.id = cp.room_id
LEFT JOIN public.chat_messages cm ON cm.room_id = cp.room_id
WHERE cp.profile_id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd'  -- tutor
GROUP BY cp.room_id, cr.type, cr.created_at
ORDER BY cr.created_at DESC;

-- 2. Latest messages and which room they're in
SELECT cm.room_id, cm.content, cm.sender_id, cm.created_at
FROM public.chat_messages cm
ORDER BY cm.created_at DESC
LIMIT 10;

-- 3. All participants in room 1e16b20a (the room with messages)
SELECT cp.profile_id, p.email, p.role
FROM public.chat_participants cp
JOIN public.profiles p ON p.id = cp.profile_id
WHERE cp.room_id = '1e16b20a-0284-423e-8f4a-658fd803cebe';

-- 4. Ensure tutor IS in that room
INSERT INTO public.chat_participants (room_id, profile_id)
VALUES ('1e16b20a-0284-423e-8f4a-658fd803cebe', 'ecd127be-a39c-48a9-8661-e50ffb2248fd')
ON CONFLICT (room_id, profile_id) DO NOTHING;

SELECT 'Tutor ensured in room 1e16b20a' as status;
