-- Fix chat_rooms_select to filter by participant membership
-- This is now SAFE from recursion because:
--   chat_rooms_select → queries chat_participants
--   chat_participants_select → queries profiles ONLY (no further chain)
-- Run in Supabase SQL Editor

DROP POLICY IF EXISTS "chat_rooms_select" ON public.chat_rooms;

-- Users can only see rooms where THEY are a participant
CREATE POLICY "chat_rooms_select" ON public.chat_rooms
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chat_participants cp
        WHERE cp.room_id = chat_rooms.id
        AND cp.profile_id = auth.uid()
    )
);

-- INSERT still uses tenant-based check (user creates room in own tenant)
-- (already correct from previous migration, no change needed)

-- Verify policies
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'chat_rooms'
ORDER BY policyname;
