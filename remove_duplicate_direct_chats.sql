-- Script para identificar y eliminar chats duplicados específicos
-- Este script encuentra chats DIRECT duplicados (mismo par de usuarios) y elimina los más recientes

-- PASO 1: Identificar chats duplicados
-- Este query muestra todos los chats DIRECT agrupados por participantes
WITH chat_pairs AS (
    SELECT 
        cr.id,
        cr.created_at,
        cr.tenant_id,
        STRING_AGG(p.first_name || ' ' || p.last_name_paternal, ' & ' ORDER BY p.first_name) as participants,
        ARRAY_AGG(cp.profile_id ORDER BY cp.profile_id) as participant_ids
    FROM chat_rooms cr
    JOIN chat_participants cp ON cr.id = cp.room_id
    JOIN profiles p ON cp.profile_id = p.id
    WHERE cr.type = 'DIRECT'
    GROUP BY cr.id, cr.created_at, cr.tenant_id
),
duplicates AS (
    SELECT 
        id,
        created_at,
        participants,
        participant_ids,
        ROW_NUMBER() OVER (PARTITION BY participant_ids ORDER BY created_at ASC) as rn
    FROM chat_pairs
)
SELECT 
    id as room_id,
    participants,
    created_at,
    CASE WHEN rn = 1 THEN '✅ MANTENER' ELSE '❌ ELIMINAR' END as accion
FROM duplicates
ORDER BY participants, created_at;

-- PASO 2: Eliminar chats duplicados (DESCOMENTA PARA EJECUTAR)
-- Este DELETE eliminará todos los chats duplicados excepto el más antiguo de cada par
/*
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
*/

-- PASO 3: Verificar resultado (ejecuta después del DELETE)
-- SELECT 
--     STRING_AGG(p.first_name || ' ' || p.last_name_paternal, ' & ' ORDER BY p.first_name) as participants,
--     COUNT(*) as chat_count
-- FROM chat_rooms cr
-- JOIN chat_participants cp ON cr.id = cp.room_id
-- JOIN profiles p ON cp.profile_id = p.id
-- WHERE cr.type = 'DIRECT'
-- GROUP BY ARRAY_AGG(cp.profile_id ORDER BY cp.profile_id)
-- HAVING COUNT(*) > 1;
