-- COMPREHENSIVE FIX: Align all chat policies to participant-based access
-- This removes all dependency on profiles.tenant_id for chat visibility
-- Run in Supabase SQL Editor

-- STEP 1: Fix tutor's tenant_id (it's null, causing all downstream policy failures)
UPDATE public.profiles 
SET tenant_id = 'efc61ce1-32c2-47b6-9751-95becd7ddc33'
WHERE id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd'
  AND (tenant_id IS NULL OR tenant_id != 'efc61ce1-32c2-47b6-9751-95becd7ddc33');

-- Verify fix
SELECT id, email, tenant_id FROM public.profiles 
WHERE id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';

-- STEP 2: Update chat_participants_select to use participant-based logic (not tenant join)
-- This way NULL tenant_id doesn't break it
DROP POLICY IF EXISTS "chat_participants_select" ON public.chat_participants;
CREATE POLICY "chat_participants_select" ON public.chat_participants
FOR SELECT USING (
    -- User can see all participants in any room they are themselves participating in
    EXISTS (
        SELECT 1 FROM public.chat_participants my_row
        WHERE my_row.room_id = chat_participants.room_id
        AND my_row.profile_id = auth.uid()
    )
);

-- STEP 3: Update chat_messages_select to use participant-based logic (not tenant_id)
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can only read messages from their own rooms" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages
FOR SELECT USING (
    -- User can read messages in rooms they participate in
    EXISTS (
        SELECT 1 FROM public.chat_participants cp
        WHERE cp.room_id = chat_messages.room_id
        AND cp.profile_id = auth.uid()
    )
);

-- STEP 4: Clean up orphan duplicate insert policy on chat_messages
DROP POLICY IF EXISTS "Users can only send messages to their own rooms" ON public.chat_messages;

-- STEP 5: Verify final policies
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('chat_rooms', 'chat_participants', 'chat_messages')
ORDER BY tablename, cmd;
