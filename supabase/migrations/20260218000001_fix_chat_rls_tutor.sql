-- Migration: Fix chat RLS to allow TUTOR and all roles to create chat rooms
-- Run this in Supabase SQL Editor
-- Date: 2026-02-18

-- ===================================================
-- FIX 1: chat_rooms - Add INSERT, UPDATE, DELETE policies
-- ===================================================

DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view their own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "View own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_select" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_insert" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_update" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_delete" ON public.chat_rooms;

-- SELECT: Any user in the same tenant can see rooms
CREATE POLICY "chat_rooms_select" ON public.chat_rooms
FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- INSERT: Any authenticated user in a tenant can create a room in THEIR tenant
CREATE POLICY "chat_rooms_insert" ON public.chat_rooms
FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- UPDATE: Users in that tenant can update rooms
CREATE POLICY "chat_rooms_update" ON public.chat_rooms
FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- DELETE: Users in that tenant can delete rooms
CREATE POLICY "chat_rooms_delete" ON public.chat_rooms
FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- ===================================================
-- FIX 2: chat_participants - Add INSERT and DELETE policies
-- ===================================================

DROP POLICY IF EXISTS "View participants" ON public.chat_participants;
DROP POLICY IF EXISTS "chat_participants_select" ON public.chat_participants;
DROP POLICY IF EXISTS "chat_participants_insert" ON public.chat_participants;
DROP POLICY IF EXISTS "chat_participants_delete" ON public.chat_participants;

-- SELECT: Users can see participants in rooms within their tenant
CREATE POLICY "chat_participants_select" ON public.chat_participants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = chat_participants.room_id
        AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
);

-- INSERT: Users can add participants to rooms in their tenant
CREATE POLICY "chat_participants_insert" ON public.chat_participants
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = chat_participants.room_id
        AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
);

-- DELETE: Users can remove participants from rooms in their tenant
CREATE POLICY "chat_participants_delete" ON public.chat_participants
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = chat_participants.room_id
        AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
);

-- ===================================================
-- FIX 3: Ensure TUTOR profile has correct tenant_id
-- The tutor helmerferras@gmail.com (ecd127be) should point to the SCHOOL tenant
-- ===================================================

UPDATE public.profiles
SET tenant_id = 'efc61ce1-32c2-47b6-9751-95becd7ddc33'
WHERE id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd'
AND (tenant_id IS NULL OR tenant_id != 'efc61ce1-32c2-47b6-9751-95becd7ddc33');

-- Verify
SELECT id, email, role, tenant_id 
FROM public.profiles 
WHERE id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
