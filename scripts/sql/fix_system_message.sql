-- Fix for send_system_message and chat_messages constraints

-- 1. Ensure sender_id can be NULL for System messages
ALTER TABLE public.chat_messages ALTER COLUMN sender_id DROP NOT NULL;

-- 2. Drop function to ensure clean recreation
DROP FUNCTION IF EXISTS public.send_system_message(uuid, text, jsonb);

-- 3. Recreate the function with strict typing and explicitly naming parameters
CREATE OR REPLACE FUNCTION public.send_system_message(
    p_room_id uuid,
    p_content text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_msg_id uuid;
BEGIN
    -- Insert message with NULL sender_id (system)
    INSERT INTO public.chat_messages (room_id, sender_id, content, type, metadata)
    VALUES (p_room_id, NULL, p_content, 'SYSTEM', p_metadata)
    RETURNING id INTO v_msg_id;
    
    RETURN v_msg_id;
END;
$$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.send_system_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_system_message TO service_role;

-- 5. Ensure get_or_create_system_room exists (it was called before)
-- Just in case, let's redefine it to be safe.
CREATE OR REPLACE FUNCTION public.get_or_create_system_room(
    p_tenant_id uuid,
    p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id uuid;
BEGIN
    -- Check if a system room exists for these participants (User + System/Null)
    -- Actually, system rooms usually are just 1-on-1 with a specific type?
    -- Let's check if we have a room of type 'SYSTEM' for this user
    
    SELECT id INTO v_room_id
    FROM public.chat_rooms
    WHERE tenant_id = p_tenant_id
    AND type = 'SYSTEM'
    AND created_by = p_user_id -- Usually user creates their own support/system thread?
    LIMIT 1;

    -- If not found, look for one where user is participant
    IF v_room_id IS NULL THEN
        SELECT r.id INTO v_room_id
        FROM public.chat_rooms r
        JOIN public.chat_participants cp ON cp.room_id = r.id
        WHERE r.tenant_id = p_tenant_id
        AND r.type = 'SYSTEM'
        AND cp.profile_id = p_user_id
        LIMIT 1;
    END IF;

    -- Create if still null
    IF v_room_id IS NULL THEN
        INSERT INTO public.chat_rooms (tenant_id, type, name, created_by)
        VALUES (p_tenant_id, 'SYSTEM', 'Notificaciones del Sistema', p_user_id)
        RETURNING id INTO v_room_id;

        -- Add user as participant
        INSERT INTO public.chat_participants (room_id, profile_id)
        VALUES (v_room_id, p_user_id);
        
        -- We don't need to add "System" as participant if sender_id is NULL
    END IF;

    RETURN v_room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_system_room TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_system_room TO service_role;
