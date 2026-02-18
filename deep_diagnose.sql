-- SCRIPT: BÚSQUEDA DE OBJETOS ROTOS (Ghost in the machine)
-- Este script busca errores estructurales que GoTrue no puede procesar.

-- 1. Buscar TRIGGERS que llamen a funciones inexistentes
SELECT 
    trg.tgname AS trigger_name,
    rel.relname AS table_name,
    nsp.nspname AS schema_name,
    proc.proname AS function_name
FROM pg_trigger trg
JOIN pg_class rel ON trg.tgrelid = rel.oid
JOIN pg_namespace nsp ON rel.relnamespace = nsp.oid
JOIN pg_proc proc ON trg.tgfoid = proc.oid
WHERE nsp.nspname IN ('auth', 'public')
AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = trg.tgfoid);

-- 2. Listar TODAS las funciones que involucren 'auth' o 'profile'
-- (Para ver si alguna tiene errores lógicos internos)
SELECT 
    n.nspname as schema,
    p.proname as name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND (p.proname LIKE '%auth%' OR p.proname LIKE '%profile%' OR p.proname LIKE '%admin%');

-- 3. Verificar si hay VISTAS rotas (Si una vista falla el schema query, da 500)
-- Intentaremos seleccionar 0 filas de cada vista sospechosa.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT table_schema, table_name FROM information_schema.views WHERE table_schema IN ('public', 'auth')) LOOP
        BEGIN
            EXECUTE format('SELECT * FROM %I.%I LIMIT 0', r.table_schema, r.table_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'VISTA ROTA ENCONTRADA: %.% - Error: %', r.table_schema, r.table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 4. Verificar permisos del rol 'authenticator'
-- Este rol es el que usa Supabase internamente para el login.
SELECT 
    table_schema, 
    table_name, 
    privilege_type
FROM information_schema.role_table_grants 
WHERE grantee = 'authenticator' 
AND table_schema IN ('auth', 'public')
LIMIT 50;
