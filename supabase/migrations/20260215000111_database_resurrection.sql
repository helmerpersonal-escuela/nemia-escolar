-- ==========================================
-- NUCLEAR DATABASE RESURRECTION (V3)
-- ==========================================
-- Este script es el definitivo para arreglar errores 406 y 400.

BEGIN;

-- 1. Reparar Tabla de Profiles (Crítico para God Mode)
-- Si la tabla ya existe, nos aseguramos de que tenant_id sea NULLABLE.
DO $$ 
BEGIN
    -- Crear si no existe
    CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
        tenant_id uuid REFERENCES public.tenants(id),
        role text NOT NULL,
        full_name text,
        first_name text,
        created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    
    -- REFUERZO: Asegurar nulabilidad
    ALTER TABLE public.profiles ALTER COLUMN tenant_id DROP NOT NULL;

    -- Agregar columnas faltantes si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_name_paternal') THEN ALTER TABLE public.profiles ADD COLUMN last_name_paternal text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_name_maternal') THEN ALTER TABLE public.profiles ADD COLUMN last_name_maternal text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN ALTER TABLE public.profiles ADD COLUMN avatar_url text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='nationality') THEN ALTER TABLE public.profiles ADD COLUMN nationality text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='birth_date') THEN ALTER TABLE public.profiles ADD COLUMN birth_date date; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='sex') THEN ALTER TABLE public.profiles ADD COLUMN sex text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='marital_status') THEN ALTER TABLE public.profiles ADD COLUMN marital_status text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='curp') THEN ALTER TABLE public.profiles ADD COLUMN curp text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rfc') THEN ALTER TABLE public.profiles ADD COLUMN rfc text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_particular') THEN ALTER TABLE public.profiles ADD COLUMN address_particular text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone_contact') THEN ALTER TABLE public.profiles ADD COLUMN phone_contact text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_setup_completed') THEN ALTER TABLE public.profiles ADD COLUMN profile_setup_completed boolean DEFAULT false; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='work_start_time') THEN ALTER TABLE public.profiles ADD COLUMN work_start_time time DEFAULT '07:00:00'; END IF;
END $$;

-- 2. Asegurar Tablas de Soporte
CREATE TABLE IF NOT EXISTS public.profile_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL,
    UNIQUE(profile_id, role)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'trialing',
    current_period_end timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2.1 Tablas de Sistema (Arregla 406 en Dashboard)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text,
    description text,
    updated_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    user_id uuid REFERENCES auth.users(id),
    amount numeric(10, 2),
    status text,
    created_at timestamp with time zone DEFAULT now()
);

-- 2.2 Datos de Sistema Iniciales
INSERT INTO public.system_settings (key, value, description)
VALUES ('chat_sound_url', 'https://aveqziaewxcglhteufft.supabase.co/storage/v1/object/public/system/notification.mp3', 'Sonido de notificación de chat')
ON CONFLICT (key) DO NOTHING;

-- 3. Restaurar Super Admin (helmerferras@gmail.com)
DO $$
DECLARE
    target_email text := 'helmerferras@gmail.com';
    target_uid uuid;
BEGIN
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NOT NULL THEN
        -- Insertar/Actualizar Perfil (God Mode tiene tenant_id = NULL)
        INSERT INTO public.profiles (id, role, full_name, first_name, tenant_id)
        VALUES (target_uid, 'SUPER_ADMIN', 'Super Admin', 'Helmer', NULL)
        ON CONFLICT (id) DO UPDATE SET 
            role = 'SUPER_ADMIN', 
            tenant_id = NULL;

        -- Insertar Rol
        INSERT INTO public.profile_roles (profile_id, role)
        VALUES (target_uid, 'SUPER_ADMIN')
        ON CONFLICT DO NOTHING;

        -- Suscripción Vitalicia
        INSERT INTO public.subscriptions (user_id, status, current_period_end)
        VALUES (target_uid, 'active', now() + interval '100 years')
        ON CONFLICT (user_id) DO UPDATE SET 
            status = 'active', 
            current_period_end = now() + interval '100 years';

        RAISE NOTICE 'Nuclear Resurrection Success for %', target_email;
    END IF;
END $$;

-- 4. PERMISOS TOTALES (Evita 406)
-- Exponemos las tablas al motor de la API
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.profile_roles TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated, anon;
GRANT SELECT ON public.tenants TO authenticated, anon;

-- 5. RELOAD SCHEMA (Forzar a PostgREST a ver los cambios)
NOTIFY pgrst, 'reload schema';

COMMIT;
