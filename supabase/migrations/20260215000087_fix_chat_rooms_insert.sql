-- Fix chat_rooms INSERT policy to allow room creation
-- The previous policy had a circular reference to chat_rooms.tenant_id before the row exists

DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;

CREATE POLICY "Users can create rooms" ON public.chat_rooms
FOR INSERT WITH CHECK (
    -- Allow users to create rooms in their own tenant
    tenant_id IN (
        SELECT tenant_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);
