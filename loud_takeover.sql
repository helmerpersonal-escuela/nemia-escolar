-- SCRIPT: TOMA DE CONTROL (The Loud Takeover)
-- Este script NO tiene capturas de error (EXCEPTION) para que falle fuerte y nos diga por qué.

-- 1. Intentar cambiar el dueño del esquema a postgres (tú)
-- Si esto funciona, podremos dar permisos sin problemas.
ALTER SCHEMA auth OWNER TO postgres;

-- 2. Si el paso anterior funcionó, damos los permisos con todo el poder
GRANT ALL ON SCHEMA auth TO anon, authenticated, authenticator, service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO anon, authenticated, authenticator, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO anon, authenticated, authenticator, service_role, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, authenticator, service_role, postgres;

-- 3. Devolver la propiedad a supabase_admin (por seguridad y estándar de Supabase)
ALTER SCHEMA auth OWNER TO supabase_admin;

-- 4. Verificación final directa
SELECT 
    nspname as esquema,
    has_schema_privilege('authenticator', 'auth', 'USAGE') as portero_reparado,
    nspacl as acl_final
FROM pg_namespace 
WHERE nspname = 'auth';
