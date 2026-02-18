
-- ==============================================================================
-- PAQUETE DE ACTUALIZACIÓN - SISTEMA NEMIA (PRODUCCIÓN)
-- Fecha: 13/02/2026
-- Descripción: Script consolidado para habilitar Módulo de Pagos, Licencias, 
--              Permisos de SuperAdmin y Funciones de Limpieza/Mantenimiento.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SISTEMA DE LICENCIAS Y LÍMITES (Requerido para pagos)
-- ------------------------------------------------------------------------------

-- 1.1 Crear tabla de límites
CREATE TABLE IF NOT EXISTS license_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_type VARCHAR(20) UNIQUE NOT NULL CHECK (plan_type IN ('basic', 'pro')),
    max_groups INTEGER NOT NULL,
    max_students_per_group INTEGER NOT NULL,
    price_annual DECIMAL(10,2) NOT NULL,
    trial_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Agregar columna 'plan_type' a suscripciones si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'plan_type'
    ) THEN
        ALTER TABLE subscriptions 
        ADD COLUMN plan_type VARCHAR(20) DEFAULT 'basic' CHECK (plan_type IN ('basic', 'pro'));
    END IF;
END $$;

-- 1.3 Insertar configuración de planes
INSERT INTO license_limits (plan_type, max_groups, max_students_per_group, price_annual, trial_days) 
VALUES 
    ('basic', 2, 50, 399.00, 30),
    ('pro', 5, 50, 599.00, 30)
ON CONFLICT (plan_type) DO UPDATE SET
    max_groups = EXCLUDED.max_groups,
    max_students_per_group = EXCLUDED.max_students_per_group,
    price_annual = EXCLUDED.price_annual,
    trial_days = EXCLUDED.trial_days,
    updated_at = NOW();

-- 1.4 Actualizar suscripciones existentes a 'basic'
UPDATE subscriptions 
SET plan_type = 'basic' 
WHERE plan_type IS NULL;

-- 1.5 Crear índice y permisos
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_type ON subscriptions(plan_type);

ALTER TABLE license_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view license limits" ON license_limits;
CREATE POLICY "Anyone can view license limits" ON license_limits
    FOR SELECT TO authenticated USING (true);


-- ------------------------------------------------------------------------------
-- 2. HABILITAR FUNCIONALIDADES (Borrado suave y botón cancelar)
-- ------------------------------------------------------------------------------

-- 2.1 Política para que usuarios puedan cancelar (actualizar) su propia suscripción
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'subscriptions' 
        AND policyname = 'Users can update their own subscription'
    ) THEN
        CREATE POLICY "Users can update their own subscription"
        ON public.subscriptions
        FOR UPDATE TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- 2.2 Función robusta para eliminar cuenta (Soft Delete)
CREATE OR REPLACE FUNCTION public.soft_delete_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_email text;
    new_email text;
BEGIN
    -- Get current email
    select email into current_email from auth.users where id = target_user_id;

    -- Create a "tombstone" email to release the original one
    new_email := current_email || '.deleted.' || floor(extract(epoch from now())) || '@internal.edu';

    -- Update auth.users
    update auth.users 
    set email = new_email, 
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object('deleted_original_email', current_email)
    where id = target_user_id;

    -- Mark profile as deleted
    update public.profiles 
    set deleted_at = now()
    where id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_account(uuid) TO authenticated;


-- ------------------------------------------------------------------------------
-- 3. PERMISOS DE SUPER ADMIN (God Mode)
-- ------------------------------------------------------------------------------

-- 3.1 Función is_super_admin actualizada
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := auth.jwt() ->> 'email';
  -- Hardcoded Owners
  IF v_email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com', 'helmerferra@gmail.com', 'admin@nemia.com') THEN
    RETURN TRUE;
  END IF;
  -- Role check
  IF EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- 3.2 Función de tamaño de DB
CREATE OR REPLACE FUNCTION public.get_database_size()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN pg_database_size(current_database());
END;
$$;

-- 3.3 Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_database_size() TO authenticated;


-- ------------------------------------------------------------------------------
-- 4. UTILIDAD DE LIMPIEZA TOTAL (Para usuarios de prueba)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION clean_test_user(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Get User ID
  select id into v_user_id from auth.users where email = target_email;
  
  if v_user_id is null then
    raise notice 'User % not found', target_email;
    return;
  end if;

  -- Get Tenant ID
  select tenant_id into v_tenant_id from public.profiles where id = v_user_id;
  
  if v_tenant_id is null then
     delete from auth.users where id = v_user_id;
     raise notice 'User % deleted (had no tenant)', target_email;
     return;
  end if;

  -- Delete Tenant Data (Phase 2+)
  delete from public.attendance where tenant_id = v_tenant_id;
  delete from public.grades where tenant_id = v_tenant_id;
  delete from public.assignments where tenant_id = v_tenant_id;
  delete from public.lesson_plans where tenant_id = v_tenant_id;
  delete from public.analytical_programs where tenant_id = v_tenant_id;
  
  -- Phase 2 Core
  delete from public.students where tenant_id = v_tenant_id;
  delete from public.groups where tenant_id = v_tenant_id;
  delete from public.academic_years where tenant_id = v_tenant_id;
  
  -- Phase 1 Data
  delete from public.profile_subjects where tenant_id = v_tenant_id;
  delete from public.school_details where tenant_id = v_tenant_id;
  delete from public.school_announcements where tenant_id = v_tenant_id;
  
  -- Delete Profile Links
  delete from public.profile_tenants where tenant_id = v_tenant_id;
  delete from public.profile_roles where profile_id = v_user_id;

  -- Delete Financial & Audit Data
  delete from public.payment_transactions where user_id = v_user_id;
  delete from public.subscriptions where user_id = v_user_id;
  delete from public.audit_logs where changed_by = v_user_id;
  
  -- Delete Profile
  delete from public.profiles where id = v_user_id;
  
  -- Delete Tenant
  delete from public.tenants where id = v_tenant_id;
  
  -- Delete Auth User
  delete from auth.users where id = v_user_id;
  
  raise notice 'Cleanup complete for %', target_email;
END;
$$;

COMMIT;
