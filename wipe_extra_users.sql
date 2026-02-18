-- SCRIPT: LIMPIEZA TOTAL DE USUARIOS V3 (Nuke extra users - Deep Clean)
-- Este script elimina a TODOS los usuarios excepto a helmerpersonal@gmail.com
-- Maneja dependencias profundas como audit_logs y perfiles.

DO $$
DECLARE
    v_admin_email TEXT := 'helmerpersonal@gmail.com';
    v_admin_id UUID;
BEGIN
    -- 0. Identificar al admin
    SELECT id INTO v_admin_id FROM auth.users WHERE email = v_admin_email;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró al admin %. Primero créalo.', v_admin_email;
    END IF;

    -- 1. Eliminar AUDIT LOGS de los demás (FInalmente llegamos aquí)
    DELETE FROM public.audit_logs WHERE changed_by != v_admin_id;

    -- 2. Eliminar dependencias de perfiles (Excepto el admin)
    DELETE FROM public.profile_subjects WHERE profile_id != v_admin_id;
    DELETE FROM public.profile_roles WHERE profile_id != v_admin_id;
    DELETE FROM public.staff_commissions WHERE profile_id != v_admin_id;
    DELETE FROM public.staff_attendance WHERE profile_id != v_admin_id;
    
    -- 3. Eliminar dependencias de usuarios (Excepto el admin)
    DELETE FROM public.subscriptions WHERE user_id != v_admin_id;
    DELETE FROM public.payment_transactions WHERE user_id != v_admin_id;
    
    -- 4. Borrar perfiles (Excepto el admin)
    DELETE FROM public.profiles WHERE id != v_admin_id;

    -- 5. Eliminar identidades de los demás
    DELETE FROM auth.identities WHERE user_id != v_admin_id;

    -- 6. Finalmente, borrar a los usuarios en auth.users excepto el admin
    DELETE FROM auth.users WHERE id != v_admin_id;

    RAISE NOTICE 'Limpieza profunda completada. Solo queda la cuenta: %', v_admin_email;
END $$;

-- Verificación final
SELECT count(*) as total_users FROM auth.users;
SELECT email FROM auth.users;
