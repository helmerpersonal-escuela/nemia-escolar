-- Migración para agregar política RLS de DELETE en chat_rooms
-- y limpiar chats duplicados

-- 1. Crear política de DELETE para chat_rooms
DROP POLICY IF EXISTS "Users can delete rooms they participate in" ON chat_rooms;

CREATE POLICY "Users can delete rooms they participate in"
ON chat_rooms
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM chat_participants
        WHERE chat_participants.room_id = chat_rooms.id
        AND chat_participants.profile_id = auth.uid()
    )
);

-- 2. Limpiar chats DIRECT duplicados (mantener solo el más antiguo por par de usuarios)
DELETE FROM chat_rooms
WHERE id IN (
    WITH chat_pairs AS (
        SELECT 
            cr.id,
            cr.created_at,
            ARRAY_AGG(cp.profile_id ORDER BY cp.profile_id) as participant_ids
        FROM chat_rooms cr
        JOIN chat_participants cp ON cr.id = cp.room_id
        WHERE cr.type = 'DIRECT'
        GROUP BY cr.id, cr.created_at
    ),
    duplicates AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY participant_ids ORDER BY created_at ASC) as rn
        FROM chat_pairs
    )
    SELECT id
    FROM duplicates
    WHERE rn > 1
);

-- 3. Verificar políticas de DELETE
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'chat_rooms' AND cmd = 'DELETE';
