-- SCRIPT: RESET NUCLEAR DE PERMISOS Y ESQUEMA (The Final Stand)
-- Este script ataca la raíz del Error 500 re-estableciendo los permisos de Supabase.

-- 1. Asegurar Extensiones Críticas
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- 2. Resetear Permisos de Esquema (Esto suele arreglar el "querying schema" error)
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO service_role;

-- 3. Permisos para el rol 'authenticator' (El que usa GoTrue internamente)
GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticator;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticator;

-- 4. Sincronización Final del Usuario 'helmerpersonal@gmail.com'
DO $$
DECLARE
    v_user_id UUID := '7bf6ebd0-fbf0-40f5-870a-ff9725ba80da';
    v_instance_id UUID;
BEGIN
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
    IF v_instance_id IS NULL THEN v_instance_id := '00000000-0000-0000-0000-000000000000'; END IF;

    -- Forzar campos técnicos para GoTrue
    UPDATE auth.users 
    SET 
        instance_id = v_instance_id,
        aud = 'authenticated',
        role = 'authenticated',
        encrypted_password = crypt('nemia2026', gen_salt('bf', 10)),
        email_confirmed_at = NOW(),
        last_sign_in_at = NOW(),
        raw_app_meta_data = '{"provider": "email", "providers": ["email"]}',
        is_sso_user = false,
        is_anonymous = false
    WHERE email = 'helmerpersonal@gmail.com';

    -- Sincronizar Identidad
    UPDATE auth.identities 
    SET identity_data = jsonb_build_object('sub', v_user_id, 'email', 'helmerpersonal@gmail.com'),
        provider_id = 'helmerpersonal@gmail.com'
    WHERE user_id = v_user_id;

    -- Limpiar Tokens (Evitar sesiones huérfanas)
    UPDATE auth.users SET confirmation_token = '', recovery_token = '', email_change_token_new = '' WHERE id = v_user_id;
END $$;

-- 5. Recarga Forzosa de PostgREST
NOTIFY pgrst, 'reload schema';

-- 6. Verificación de Identidades (Debe haber 1 y solo 1 con el email correcto)
SELECT id, email, provider, last_sign_in_at FROM auth.identities WHERE email = 'helmerpersonal@gmail.com';
