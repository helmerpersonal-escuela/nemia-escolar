-- Limpiar chats del sistema duplicados
-- Solo debe existir UNA sala SYSTEM por tenant

-- 1. Ver todas las salas SYSTEM y sus fechas de creación
SELECT 
    id,
    name,
    type,
    tenant_id,
    created_at
FROM chat_rooms
WHERE type = 'SYSTEM'
ORDER BY tenant_id, created_at;

-- 2. Eliminar salas SYSTEM duplicadas, manteniendo solo la más antigua por tenant
-- EJECUTA ESTO DESPUÉS DE REVISAR LOS RESULTADOS DEL QUERY ANTERIOR
DELETE FROM chat_rooms
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) as rn
        FROM chat_rooms
        WHERE type = 'SYSTEM'
    ) ranked
    WHERE rn > 1
);

-- 3. Verificar que solo quede una sala SYSTEM por tenant
SELECT 
    tenant_id,
    COUNT(*) as system_rooms_count
FROM chat_rooms
WHERE type = 'SYSTEM'
GROUP BY tenant_id;
