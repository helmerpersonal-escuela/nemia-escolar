-- Fix chat_messages RLS - allow TUTOR (and all roles) to send messages
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/xgrwivblrrucucjhrmni/sql/new

-- Drop old chat_messages policies
DROP POLICY IF EXISTS "Send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Read messages" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_delete" ON public.chat_messages;

-- INSERT: Any authenticated user can send messages, as long as sender_id = their own ID
-- This is safe because a user can only ever send as themselves
CREATE POLICY "chat_messages_insert" ON public.chat_messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
);

-- SELECT: Users can read messages in rooms that belong to their tenant
-- Only queries profiles table - no recursion possible
CREATE POLICY "chat_messages_select" ON public.chat_messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = chat_messages.room_id
        AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
);

-- DELETE: Users can only delete their own messages
CREATE POLICY "chat_messages_delete" ON public.chat_messages
FOR DELETE USING (
    sender_id = auth.uid()
);

-- Verify all chat policies are now clean
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('chat_rooms', 'chat_participants', 'chat_messages')
ORDER BY tablename, policyname;
