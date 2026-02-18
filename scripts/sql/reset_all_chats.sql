-- ⚠️ ADVERTENCIA: Este script eliminará TODOS los chats y mensajes
-- Úsalo solo si quieres empezar completamente de cero

-- 1. Ver cuántos registros se eliminarán
SELECT 
    'chat_messages' as tabla,
    COUNT(*) as registros_a_eliminar
FROM chat_messages
UNION ALL
SELECT 
    'chat_participants' as tabla,
    COUNT(*) as registros_a_eliminar
FROM chat_participants
UNION ALL
SELECT 
    'chat_rooms' as tabla,
    COUNT(*) as registros_a_eliminar
FROM chat_rooms;

-- 2. ELIMINAR TODOS LOS CHATS (descomenta para ejecutar)
-- ⚠️ ESTO NO SE PUEDE DESHACER ⚠️

-- Paso 1: Eliminar todos los mensajes
-- DELETE FROM chat_messages;

-- Paso 2: Eliminar todos los participantes
-- DELETE FROM chat_participants;

-- Paso 3: Eliminar todas las salas
-- DELETE FROM chat_rooms;

-- 3. Verificar que todo se eliminó
-- SELECT 
--     'chat_messages' as tabla,
--     COUNT(*) as registros_restantes
-- FROM chat_messages
-- UNION ALL
-- SELECT 
--     'chat_participants' as tabla,
--     COUNT(*) as registros_restantes
-- FROM chat_participants
-- UNION ALL
-- SELECT 
--     'chat_rooms' as tabla,
--     COUNT(*) as registros_restantes
-- FROM chat_rooms;

-- NOTA: Después de ejecutar este script, todas las salas de chat se recrearán
-- automáticamente cuando los usuarios inicien nuevas conversaciones.
