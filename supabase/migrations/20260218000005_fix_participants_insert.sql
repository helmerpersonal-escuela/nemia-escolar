-- Fix: Add teacher to existing room + improve chat_participants INSERT policy
-- Run in Supabase SQL Editor

-- STEP 1: Manually add teacher as participant to the existing room
INSERT INTO public.chat_participants (room_id, profile_id)
VALUES (
    '1e16b20a-0284-423e-8f4a-658fd803cebe',  -- room with tutor messages
    '85870a47-4730-401d-a96c-a3712e821b3d'   -- teacher
)
ON CONFLICT (room_id, profile_id) DO NOTHING;

-- STEP 2: Update chat_participants INSERT policy to use chat_rooms instead of profiles join
-- This is safer: check if the room belongs to auth.uid()'s tenant
-- Since chat_rooms_select now ONLY queries profiles, no recursion possible.
DROP POLICY IF EXISTS "chat_participants_insert" ON public.chat_participants;
CREATE POLICY "chat_participants_insert" ON public.chat_participants
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = chat_participants.room_id
        AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
);

-- STEP 3: Verify teacher is now a participant
SELECT 
    cp.room_id,
    cp.profile_id,
    p.email,
    p.role
FROM public.chat_participants cp
JOIN public.profiles p ON p.id = cp.profile_id
WHERE cp.room_id = '1e16b20a-0284-423e-8f4a-658fd803cebe';
