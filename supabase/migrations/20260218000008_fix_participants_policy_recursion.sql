-- URGENT FIX: Replace self-referential chat_participants_select policy
-- The previous policy queried chat_participants from within itself (infinite recursion = 500 error)
-- This replaces it with a safe profiles-only tenant check
-- Run in Supabase SQL Editor NOW

-- Fix chat_participants_select: use tenant check via profiles only (no self-reference)
DROP POLICY IF EXISTS "chat_participants_select" ON public.chat_participants;

CREATE POLICY "chat_participants_select" ON public.chat_participants
FOR SELECT USING (
    -- Viewer and participant must be in the same tenant
    -- Queries profiles ONLY — no recursion possible
    (SELECT p1.tenant_id FROM public.profiles p1 WHERE p1.id = auth.uid()) =
    (SELECT p2.tenant_id FROM public.profiles p2 WHERE p2.id = chat_participants.profile_id)
);

-- Verify: no more 500 errors - test by querying
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'chat_participants'
ORDER BY policyname;
