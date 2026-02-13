-- Script para eliminar chats duplicados
-- Este script identifica y elimina salas DIRECT duplicadas manteniendo solo la más antigua

-- Primero, veamos las salas duplicadas
SELECT 
    cr.id,
    cr.created_at,
    STRING_AGG(p.first_name || ' ' || p.last_name_paternal, ', ') as participants
FROM chat_rooms cr
JOIN chat_participants cp ON cr.id = cp.room_id
JOIN profiles p ON cp.profile_id = p.id
WHERE cr.type = 'DIRECT'
GROUP BY cr.id, cr.created_at
ORDER BY participants, cr.created_at;

-- Para eliminar duplicados, ejecuta este query después de identificar los IDs:
-- DELETE FROM chat_rooms WHERE id IN (
--     'id-del-chat-duplicado-1',
--     'id-del-chat-duplicado-2'
-- );

-- Nota: Los participantes y mensajes se eliminarán automáticamente por CASCADE
