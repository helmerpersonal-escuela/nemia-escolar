-- Fix chat_participants to allow INSERT when creating rooms
-- Currently only has SELECT policy, missing INSERT policy

DROP POLICY IF EXISTS "Users can add participants" ON public.chat_participants;

CREATE POLICY "Users can add participants" ON public.chat_participants
FOR INSERT WITH CHECK (
    -- Allow users to add participants to rooms in their tenant
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = chat_participants.room_id
        AND r.tenant_id IN (
            SELECT tenant_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    )
);
