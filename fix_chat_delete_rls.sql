-- Política RLS para permitir eliminar chat_rooms
-- Los usuarios pueden eliminar salas donde son participantes

-- 1. Verificar políticas actuales de DELETE
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'chat_rooms' AND cmd = 'DELETE';

-- 2. Crear política de DELETE si no existe
-- Permite eliminar salas donde el usuario es participante
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

-- 3. Verificar que la política se creó correctamente
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'chat_rooms' AND cmd = 'DELETE';
