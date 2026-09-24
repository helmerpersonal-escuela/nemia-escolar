-- ==========================================
-- FIX: USER EMAILS & VERIFICATION RPC
-- ==========================================

BEGIN;

-- 1. Asegurar columna email en profiles
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- 2. Backfill: Sincronizar emails existentes desde auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 3. Actualizar Trigger para nuevos registros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  meta jsonb;
  tenant_name text;
  target_role text;
  is_independent boolean;
BEGIN
  meta := new.raw_user_meta_data;
  is_independent := (meta->>'mode' = 'INDEPENDENT');
  tenant_name := meta->>'organizationName';
  
  IF tenant_name IS NULL OR trim(tenant_name) = '' THEN
    tenant_name := trim(
      coalesce(meta->>'firstName', '') || ' ' || 
      coalesce(meta->>'lastNamePaternal', '') || ' ' || 
      coalesce(meta->>'lastNameMaternal', '')
    );
  END IF;
  
  IF is_independent THEN
    target_role := 'INDEPENDENT_TEACHER';
  ELSE
    target_role := 'DIRECTOR';
  END IF;

  -- Crear Tenant
  INSERT INTO public.tenants (name, type)
  VALUES (tenant_name, meta->>'mode')
  RETURNING id INTO new_tenant_id;

  -- Crear Perfil con EMAIL
  INSERT INTO public.profiles (
    id,
    tenant_id,
    first_name,
    last_name_paternal,
    last_name_maternal,
    role,
    email
  )
  VALUES (
    new.id,
    new_tenant_id,
    meta->>'firstName',
    meta->>'lastNamePaternal',
    meta->>'lastNameMaternal',
    target_role,
    new.email
  );

  RETURN new;
END;
$$;

-- 4. Recrear RPC de Verificación
CREATE OR REPLACE FUNCTION public.admin_verify_email(target_user_id UUID)
RETURNS JSONB AS $$
BEGIN
    -- Verificar si el que llama es Super Admin usando tu lógica de god_mode
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Solo Super Admins pueden validar correos.';
    END IF;

    UPDATE auth.users
    SET 
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Email verificado exitosamente');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_verify_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_email(UUID) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
