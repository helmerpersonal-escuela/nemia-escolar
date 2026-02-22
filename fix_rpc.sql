CREATE OR REPLACE FUNCTION public.get_or_create_system_room(p_tenant_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_room_id uuid;
BEGIN
    -- 1. Try to find the existing system room for this user
    SELECT r.id INTO v_room_id
    FROM chat_rooms r
    INNER JOIN chat_participants cp ON cp.room_id = r.id
    WHERE r.type = 'SYSTEM'
    AND r.tenant_id = p_tenant_id
    AND cp.profile_id = p_user_id
    LIMIT 1;

    IF v_room_id IS NOT NULL THEN
        RETURN v_room_id;
    END IF;

    -- 2. Atomic creation of the room
    BEGIN
        INSERT INTO chat_rooms (tenant_id, name, type)
        VALUES (p_tenant_id, 'Avisos del Sistema', 'SYSTEM')
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_room_id;

        -- If v_room_id is still null, it means ON CONFLICT DO NOTHING triggered because of a constraint
        -- (Even if we haven't found a unique constraint in migrations, we handle it just in case)
        IF v_room_id IS NULL THEN
             SELECT r.id INTO v_room_id
             FROM chat_rooms r
             WHERE r.type = 'SYSTEM'
             AND r.tenant_id = p_tenant_id
             AND r.name = 'Avisos del Sistema'
             LIMIT 1;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- Fallback find
        SELECT r.id INTO v_room_id
        FROM chat_rooms r
        WHERE r.type = 'SYSTEM'
        AND r.tenant_id = p_tenant_id
        AND r.name = 'Avisos del Sistema'
        LIMIT 1;
    END;

    -- 3. Add participant (idempotent)
    IF v_room_id IS NOT NULL THEN
        INSERT INTO chat_participants (room_id, profile_id)
        VALUES (v_room_id, p_user_id)
        ON CONFLICT (room_id, profile_id) DO NOTHING;
    END IF;

    RETURN v_room_id;
END;
$$;
