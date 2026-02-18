-- SCRIPT: DIAGNÓSTICO DEFINITIVO (The Final Hunt)
-- Este script busca errores de configuración profunda que causan el Error 500.

-- 1. Verificar si 'crypt' funciona (Extensión pgcrypto)
DO $$
BEGIN
    PERFORM crypt('test', gen_salt('bf'));
    RAISE NOTICE 'pgcrypto FUNCIONA CORRECTAMENTE';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgcrypto ESTÁ ROTA O NO ENCONTRADA: %', SQLERRM;
END $$;

-- 2. Ver TODAS las columnas de auth.users para tu usuario
-- (Buscamos campos NULL que no deberían serlo)
SELECT * FROM auth.users WHERE email = 'helmerpersonal@gmail.com';

-- 3. Ver todos los TRIGGERS en el esquema auth (Poco común pero posible)
SELECT 
    event_object_table as table_name, 
    trigger_name, 
    action_statement 
FROM information_schema.triggers 
WHERE event_object_schema = 'auth';

-- 4. Verificar el Search Path del rol 'authenticator'
-- Si no incluye 'auth' y 'extensions', falla el login.
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticator', 'authenticated', 'postgres');

-- 5. Verificar si hay un ID de instancia nulo o múltiple
SELECT id, updated_at FROM auth.instances;

-- 6. Ver el estado de las identidades
SELECT * FROM auth.identities WHERE email = 'helmerpersonal@gmail.com';

-- 7. Verificar si el esquema 'auth' tiene dueños correctos
SELECT nspname, rolname as owner 
FROM pg_namespace n 
JOIN pg_authid a ON n.nspowner = a.oid 
WHERE nspname = 'auth';
