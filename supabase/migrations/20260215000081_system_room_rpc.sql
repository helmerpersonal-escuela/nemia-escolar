-- 20260215000079_system_room_rpc.sql

-- Function to safely get or create a SYSTEM room for a user
-- Needed to avoid granting broad INSERT permissions on chat_rooms to all roles
-- This runs with SECURITY DEFINER privileges (as the creator/admin)

-- 1. Allow 'SYSTEM' type in chat_rooms
ALTER TABLE public.chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_type_check;
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_type_check CHECK (type IN ('DIRECT', 'GROUP', 'CHANNEL', 'SYSTEM'));

CREATE OR REPLACE FUNCTION public.get_or_create_system_room(p_tenant_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id uuid;
BEGIN
    -- 1. Check if room exists
    SELECT r.id INTO v_room_id
    FROM chat_rooms r
    JOIN chat_participants cp ON cp.room_id = r.id
    WHERE r.type = 'SYSTEM'
    AND r.tenant_id = p_tenant_id
    AND cp.profile_id = p_user_id
    LIMIT 1;

    -- 2. Return if found
    IF v_room_id IS NOT NULL THEN
        RETURN v_room_id;
    END IF;

    -- 3. Create if not found
    INSERT INTO chat_rooms (tenant_id, name, type)
    VALUES (p_tenant_id, 'Avisos del Sistema', 'SYSTEM')
    RETURNING id INTO v_room_id;

    -- 4. Add participant
    INSERT INTO chat_participants (room_id, profile_id)
    VALUES (v_room_id, p_user_id);

    RETURN v_room_id;
END;
$$;
