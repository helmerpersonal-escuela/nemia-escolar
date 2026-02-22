-- EMERGENCY FIX: Infinite recursion in chat_participants RLS (error 42P17)
-- Root cause: chat_rooms has an old policy that queries chat_participants,
-- and chat_participants policies query chat_rooms => circular dependency.
--
-- Solution: ALL policies must only reference the `profiles` table, never each other.
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xgrwivblrrucucjhrmni/sql/new

-- =====================================================================
-- STEP 1: Nuclear drop - remove EVERY policy on both tables
-- =====================================================================

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'chat_rooms'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_rooms', pol.policyname);
        RAISE NOTICE 'Dropped chat_rooms policy: %', pol.policyname;
    END LOOP;

    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'chat_participants'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_participants', pol.policyname);
        RAISE NOTICE 'Dropped chat_participants policy: %', pol.policyname;
    END LOOP;
END $$;

-- =====================================================================
-- STEP 2: chat_rooms - Simple policies using ONLY profiles table
-- =====================================================================

-- SELECT: visible if in same tenant
CREATE POLICY "chat_rooms_select" ON public.chat_rooms
FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- INSERT: can create room in own tenant
CREATE POLICY "chat_rooms_insert" ON public.chat_rooms
FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- UPDATE: can update rooms in own tenant
CREATE POLICY "chat_rooms_update" ON public.chat_rooms
FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- DELETE: can delete rooms in own tenant
CREATE POLICY "chat_rooms_delete" ON public.chat_rooms
FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- =====================================================================
-- STEP 3: chat_participants - Policies using ONLY profiles table
-- (NO reference to chat_rooms to avoid circular dependency!)
-- =====================================================================

-- SELECT: visible if both the viewer and the participant are in the same tenant
-- We join profiles twice to find common tenant, avoiding any chat_rooms reference
CREATE POLICY "chat_participants_select" ON public.chat_participants
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p_viewer
        JOIN public.profiles p_member ON p_viewer.tenant_id = p_member.tenant_id
        WHERE p_viewer.id = auth.uid()
        AND p_member.id = chat_participants.profile_id
    )
);

-- INSERT: can add participants if viewer is in same tenant as the participant being added
-- We verify via profiles only (no chat_rooms query = no recursion)
CREATE POLICY "chat_participants_insert" ON public.chat_participants
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p_viewer
        JOIN public.profiles p_target ON p_viewer.tenant_id = p_target.tenant_id
        WHERE p_viewer.id = auth.uid()
        AND p_target.id = chat_participants.profile_id
    )
);

-- DELETE: can remove a participant if you're in the same tenant
CREATE POLICY "chat_participants_delete" ON public.chat_participants
FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p_viewer
        JOIN public.profiles p_member ON p_viewer.tenant_id = p_member.tenant_id
        WHERE p_viewer.id = auth.uid()
        AND p_member.id = chat_participants.profile_id
    )
);

-- =====================================================================
-- STEP 4: Ensure TUTOR profile has correct tenant_id
-- =====================================================================
UPDATE public.profiles
SET tenant_id = 'efc61ce1-32c2-47b6-9751-95becd7ddc33'
WHERE id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd'
  AND (tenant_id IS NULL OR tenant_id != 'efc61ce1-32c2-47b6-9751-95becd7ddc33');

-- =====================================================================
-- STEP 5: Verify - show remaining policies and tutor profile
-- =====================================================================
SELECT 
    tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('chat_rooms', 'chat_participants')
ORDER BY tablename, policyname;

SELECT id, email, role, tenant_id 
FROM public.profiles 
WHERE id = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
