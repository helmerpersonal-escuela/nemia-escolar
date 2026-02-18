-- SCRIPT: DIAGNÓSTICO PROFUNDO V3 (Buscando ID de Instancia)
-- Este script es vital para entender por qué el login da error 500.

-- 1. Ver el ID de instancia real de este proyecto de Supabase
-- (Si usamos el equivocado en el INSERT manual, el login falla)
SELECT id as real_instance_id FROM auth.instances;

-- 2. Ver el instance_id que tiene tu usuario actualmente
SELECT id, email, instance_id FROM auth.users WHERE email = 'helmerpersonal@gmail.com';

-- 3. Listar TODOS los triggers (sin filtros raros) para ver si hay alguno roto
SELECT 
    tgname as trigger_name,
    relname as table_name,
    proname as function_name
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE nspname IN ('public', 'auth') 
AND tgisinternal = false;

-- 4. Ver si hay extensiones faltantes o rotas
SELECT name, installed_version FROM pg_available_extensions WHERE installed_version IS NOT NULL;
