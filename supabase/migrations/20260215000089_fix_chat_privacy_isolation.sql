-- Migration: 20260215000087_fix_chat_privacy_isolation.sql
-- Description: Enforces strict privacy by ensuring users only see rooms where they are participants.

-- 0. HELPER FUNCTION
-- Runs with SECURITY DEFINER to bypass RLS during participation checks (prevents infinite recursion)
CREATE OR REPLACE FUNCTION is_room_participant(room_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_participants
    WHERE room_id = room_uuid
    AND profile_id = auth.uid()
  );
$$;

-- 1. FIX CHAT_ROOMS POLICIES
-- Drop legacy permissive policies that allow tenant-wide visibility
DROP POLICY IF EXISTS "View own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view their own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can only see rooms they are participants of" ON public.chat_rooms;

-- Recreate strict SELECT policy
CREATE POLICY "Users can only see rooms they are participants of"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (
    is_room_participant(id)
);


-- 2. FIX CHAT_PARTICIPANTS POLICIES
-- Drop legacy permissive policies
DROP POLICY IF EXISTS "View participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can only see participants of their own rooms" ON public.chat_participants;

-- Recreate strict SELECT policy (Can only see participants of rooms you are in)
CREATE POLICY "Users can only see participants of their own rooms"
ON public.chat_participants
FOR SELECT
TO authenticated
USING (
    is_room_participant(room_id)
);


-- 3. FIX CHAT_MESSAGES POLICIES
-- Drop legacy permissive policies
DROP POLICY IF EXISTS "Read messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can only read messages from their own rooms" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can only send messages to their own rooms" ON public.chat_messages;

-- Recreate strict SELECT policy
CREATE POLICY "Users can only read messages from their own rooms"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
    is_room_participant(room_id)
);

-- Recreate strict INSERT policy
CREATE POLICY "Users can only send messages to their own rooms"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
    is_room_participant(room_id)
);


-- 4. FIX CHAT_PARTICIPANTS INSERT POLICY
DROP POLICY IF EXISTS "Users can add participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can only add participants to rooms they belong to" ON public.chat_participants;

CREATE POLICY "Users can only add participants to rooms they belong to"
ON public.chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = public.chat_participants.room_id
        -- Ensure room is in same tenant
        AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
            -- Either the user is already a participant
            is_room_participant(r.id)
            OR
            -- Or the room is empty (creator adding first participants)
            NOT EXISTS (SELECT 1 FROM public.chat_participants cp2 WHERE cp2.room_id = r.id)
        )
    )
);


-- 5. FIX CHAT_REACTIONS POLICIES
-- Ensure reactions are also isolated
DROP POLICY IF EXISTS "View reactions" ON public.chat_reactions;
DROP POLICY IF EXISTS "Users can only see reactions in their own rooms" ON public.chat_reactions;

CREATE POLICY "Users can only see reactions in their own rooms"
ON public.chat_reactions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.chat_messages m
        JOIN public.chat_participants p ON p.room_id = m.room_id
        WHERE m.id = public.chat_reactions.message_id
        AND p.profile_id = auth.uid()
    )
);
