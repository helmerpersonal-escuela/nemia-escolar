-- Corregir política RLS de DELETE que causa recursión infinita
-- Usar una política más simple que no consulte otras tablas con RLS

-- 1. Eliminar la política problemática
DROP POLICY IF EXISTS "Users can delete rooms they participate in" ON chat_rooms;

-- 2. Crear política simplificada usando SECURITY DEFINER function
-- Primero crear la función
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

-- 3. Crear política usando la función
CREATE POLICY "Users can delete rooms they participate in"
ON chat_rooms
FOR DELETE
TO authenticated
USING (is_room_participant(id));

-- 4. Verificar la política
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'chat_rooms' AND cmd = 'DELETE';
