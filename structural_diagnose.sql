-- SCRIPT: DIAGNÓSTICO ESTRUCTURAL (The Broken Gear)
-- Busca objetos rotos o inválidos en el esquema 'auth' que causan el Error 500.

-- 1. Buscar Vistas Rotas (Si una vista falla, el 'querying schema' falla)
SELECT 
    schemaname, 
    viewname, 
    viewowner 
FROM pg_views 
WHERE schemaname = 'auth';

-- 2. Verificar Extensiones Instaladas
SELECT name, default_version, installed_version, comment 
FROM pg_available_extensions 
WHERE installed_version IS NOT NULL 
AND name IN ('pgcrypto', 'uuid-ossp', 'pgjwt', 'pg_net');

-- 3. Buscar Funciones Inválidas (que tengan errores de sintaxis o dependencias rotas)
SELECT 
    n.nspname as schema,
    p.proname as function,
    pg_get_function_arguments(p.oid) as args,
    pg_get_function_result(p.oid) as result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'auth';

-- 4. Ver si hay conflictos de ID de instancia (Otra vez, pero buscando nulos)
SELECT count(*) as total_instances FROM auth.instances;
SELECT id, email FROM auth.users WHERE instance_id IS NULL;

-- 5. Intentar un SELECT simple en cada tabla de auth para ver cuál falla
DO $$
BEGIN
    BEGIN PERFORM count(*) FROM auth.users; RAISE NOTICE 'auth.users: OK'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'auth.users: FALLA - %', SQLERRM; END;
    BEGIN PERFORM count(*) FROM auth.identities; RAISE NOTICE 'auth.identities: OK'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'auth.identities: FALLA - %', SQLERRM; END;
    BEGIN PERFORM count(*) FROM auth.instances; RAISE NOTICE 'auth.instances: OK'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'auth.instances: FALLA - %', SQLERRM; END;
    BEGIN PERFORM count(*) FROM auth.schema_migrations; RAISE NOTICE 'auth.schema_migrations: OK'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'auth.schema_migrations: FALLA - %', SQLERRM; END;
END $$;
