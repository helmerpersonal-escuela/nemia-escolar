-- =====================================================================
-- FASE 1 DE SEGURIDAD — 23/09/2026
-- Cierra los huecos críticos encontrados en la revisión del proyecto.
-- Es idempotente: se puede correr más de una vez sin romper nada.
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Eliminar exec_sql: permitía a CUALQUIERA (incluso sin sesión)
--    ejecutar SQL arbitrario con privilegios de administrador.
--    Para migraciones usa el Supabase CLI o el panel SQL.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.exec_sql(text);

-- ---------------------------------------------------------------------
-- 2. Super Admin: una sola fuente de verdad.
--    Antes back_to_god_mode confiaba en profiles.email, que el propio
--    usuario podía editar → cualquiera podía hacerse Super Admin.
--    Ahora se usa auth.users (no editable) y se exige correo confirmado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_god_mode()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profile_roles
        WHERE profile_id = auth.uid() AND role = 'SUPER_ADMIN'
    ) OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
          AND email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com')
          AND email_confirmed_at IS NOT NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.back_to_god_mode()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_god_mode() THEN
        RAISE EXCEPTION 'Not authorized to access God Mode';
    END IF;

    UPDATE public.profiles
    SET tenant_id = NULL, role = 'SUPER_ADMIN'
    WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.back_to_god_mode() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.back_to_god_mode() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Candado en profiles para cambios hechos directamente desde la app.
--    La política "Users can update own profile" dejaba a un DIRECTOR
--    cambiarse a SUPER_ADMIN o moverse a la escuela que quisiera.
--    El trigger solo actúa cuando quien escribe es la app
--    (rol authenticated/anon). Las funciones SECURITY DEFINER
--    (switch_workspace, back_to_god_mode, handle_new_user) y el
--    service role de las Edge Functions no se ven afectados.
-- ---------------------------------------------------------------------
-- Helper: ¿el usuario tiene vínculo con esa escuela (y rol)? Solo consulta
-- sus propios vínculos (o cualquiera si es Super Admin).
CREATE OR REPLACE FUNCTION public.has_tenant_link(p_profile uuid, p_tenant uuid, p_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (p_profile = auth.uid() OR public.is_god_mode())
       AND EXISTS (
            SELECT 1 FROM public.profile_tenants
            WHERE profile_id = p_profile
              AND tenant_id = p_tenant
              AND (p_role IS NULL OR upper(role) = upper(p_role))
       );
$$;
REVOKE ALL ON FUNCTION public.has_tenant_link(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_link(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF public.is_god_mode() THEN
        RETURN NEW;
    END IF;

    IF NEW.role = 'SUPER_ADMIN' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'SUPER_ADMIN') THEN
        RAISE EXCEPTION 'No autorizado: no puedes asignarte el rol SUPER_ADMIN';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'No autorizado: el correo se cambia desde la cuenta de acceso, no desde el perfil';
        END IF;

        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
            IF NEW.tenant_id IS NULL OR NOT public.has_tenant_link(NEW.id, NEW.tenant_id) THEN
                RAISE EXCEPTION 'No autorizado: no perteneces a esa escuela';
            END IF;
        END IF;

        IF NEW.role IS DISTINCT FROM OLD.role THEN
            IF NOT public.has_tenant_link(NEW.id, NEW.tenant_id, NEW.role) THEN
                RAISE EXCEPTION 'No autorizado: no tienes ese rol en esta escuela';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER tr_guard_profile_sensitive_columns
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- ---------------------------------------------------------------------
-- 4. profiles: quitar la lectura pública (exponía nombres y correos de
--    todos los usuarios a cualquiera). Siguen vigentes:
--    "Users can view own profile", "Users within same tenant can view
--    each other" y "Super Admins can view all profiles".
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

-- ---------------------------------------------------------------------
-- 5. system_settings: guardaba el Access Token de Mercado Pago, la
--    contraseña SMTP y las llaves de IA con lectura Y ESCRITURA pública.
--    Cualquiera podía robar el token o reemplazarlo por el suyo.
--    Nuevo esquema:
--      - Secretos de servidor (tokens, SMTP): solo Super Admin.
--      - Llaves de IA: usuarios con sesión (temporal, hasta mover la IA
--        a una Edge Function — Fase 1b).
--      - Resto (textos de landing, sonidos, llave pública MP): público.
--      - Escribir: solo Super Admin.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.system_setting_visibility(setting_key text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE
        WHEN setting_key = 'mercadopago_public_key' THEN 'public'
        WHEN setting_key ~* '(access_token|token|secret|password|passwd|smtp_pass|smtp_user|service_role|webhook|private)' THEN 'server'
        WHEN setting_key ~* '(openai|gemini|groq|anthropic)_key' THEN 'authenticated'
        ELSE 'public'
    END;
$$;

DROP POLICY IF EXISTS "Public can view system settings"   ON public.system_settings;
DROP POLICY IF EXISTS "Public can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can insert system settings" ON public.system_settings;
DROP POLICY IF EXISTS "SuperAdmins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated Users Read Settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public read for system settings" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_read"  ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_write" ON public.system_settings;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_read" ON public.system_settings
FOR SELECT USING (
    public.system_setting_visibility(key) = 'public'
    OR (public.system_setting_visibility(key) = 'authenticated' AND auth.uid() IS NOT NULL)
    OR public.is_god_mode()
);

CREATE POLICY "system_settings_write" ON public.system_settings
FOR ALL
USING (public.is_god_mode())
WITH CHECK (public.is_god_mode());

REVOKE INSERT, UPDATE, DELETE ON public.system_settings FROM anon;

-- ---------------------------------------------------------------------
-- 6. Pagos y licencias: cualquiera podía INSERTAR licencias (plan Pro
--    gratis) y ver todos los pagos. El webhook usa service role, así que
--    no necesita estas políticas.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view payment_transactions"   ON public.payment_transactions;
DROP POLICY IF EXISTS "Public can insert payment_transactions" ON public.payment_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.payment_transactions FROM anon, authenticated;
REVOKE SELECT ON public.payment_transactions FROM anon;

DROP POLICY IF EXISTS "Public can view licenses"   ON public.licenses;
DROP POLICY IF EXISTS "Public can insert licenses" ON public.licenses;
REVOKE INSERT, UPDATE, DELETE ON public.licenses FROM anon, authenticated;
REVOKE SELECT ON public.licenses FROM anon;

DROP POLICY IF EXISTS "Tenants can view their active license" ON public.licenses;
CREATE POLICY "Tenants can view their active license" ON public.licenses
FOR SELECT USING (
    tenant_id IN (SELECT pt.tenant_id FROM public.profile_tenants pt WHERE pt.profile_id = auth.uid())
    OR public.is_god_mode()
);

-- ---------------------------------------------------------------------
-- 7. profile_tenants: cada usuario puede ver SUS vínculos con escuelas
--    (la app los consulta; antes solo el Super Admin podía).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own links" ON public.profile_tenants;
CREATE POLICY "Users can view own links" ON public.profile_tenants
FOR SELECT USING (profile_id = auth.uid());

-- ---------------------------------------------------------------------
-- 8. Tablas SIN RLS (cualquiera podía leer/escribir/borrar):
--    staff_attendance → solo miembros de la escuela.
--    audit_logs       → solo Super Admin (el trigger de auditoría es
--                       SECURITY DEFINER y sigue escribiendo).
--    temp_diagnostic  → tabla de depuración, se elimina.
-- ---------------------------------------------------------------------
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant members manage staff attendance" ON public.staff_attendance;
CREATE POLICY "Tenant members manage staff attendance" ON public.staff_attendance
FOR ALL
USING (
    tenant_id IN (SELECT pt.tenant_id FROM public.profile_tenants pt WHERE pt.profile_id = auth.uid())
    OR public.is_god_mode()
)
WITH CHECK (
    tenant_id IN (SELECT pt.tenant_id FROM public.profile_tenants pt WHERE pt.profile_id = auth.uid())
    OR public.is_god_mode()
);
REVOKE ALL ON public.staff_attendance FROM anon;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Super Admins read audit logs" ON public.audit_logs
FOR SELECT USING (public.is_god_mode());
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
REVOKE SELECT ON public.audit_logs FROM anon;

DROP TABLE IF EXISTS public.temp_diagnostic;

COMMIT;
