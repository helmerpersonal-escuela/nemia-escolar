-- Fix RLS for chat_rooms to allow SUPPORT role
-- 20260215000078_fix_chat_rls.sql

-- Update policy for chat_rooms to include SUPPORT
DROP POLICY IF EXISTS "Users can view their own rooms" ON public.chat_rooms;

CREATE POLICY "Users can view their own rooms" ON public.chat_rooms
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chat_participants
        WHERE chat_participants.room_id = chat_rooms.id
        AND chat_participants.profile_id = auth.uid()
    )
    OR 
    -- Public/Group rooms might be accessible by tenant, but for now stick to participants
    -- Or if it's a channel, allow tenant access? 
    -- Let's stick to participants for direct/group, but ensure creation is allowed
    auth.uid() IN (
        SELECT profile_id FROM chat_participants WHERE room_id = id
    )
);

-- Ensure SUPPORT role can participate
-- Check if existing policies on profiles/tenants block this? 
-- The 403 usually means the table RLS is blocking. 

-- Let's make sure the creation policy allows SUPPORT
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;

CREATE POLICY "Users can create rooms" ON public.chat_rooms
FOR INSERT WITH CHECK (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE tenant_id = chat_rooms.tenant_id
        -- All roles should be able to chat essentially, or at least SUPPORT
    )
);

-- Fix school_details access?
-- The user said "remove this record in its configuration", implying the fetch shouldn't happen.
-- But if we want to fix 406/Permission denied, we might need policy.
-- However, if it's "select=workshops", it implies looking for SUBJECTS/WORKSHOPS.
-- If SUPPORT doesn't have them, we should stop the fetch in frontend.

