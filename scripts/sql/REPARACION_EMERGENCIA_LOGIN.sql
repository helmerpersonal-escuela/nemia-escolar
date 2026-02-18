-- ======================================================
-- REPARACIÓN DE EMERGENCIA - LOGIN (NEMIA)
-- ======================================================
-- 1. Deshabilitar triggers que puedan estar fallando
ALTER TABLE auth.users DISABLE TRIGGER IF NOT EXISTS on_auth_user_created;

-- 2. Detectar ID de proyecto (instance_id)
DO $$
DECLARE
    v_instance_id uuid;
BEGIN
    SELECT instance_id INTO v_instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1;
    
    IF v_instance_id IS NULL THEN
        RAISE NOTICE 'No hay usuarios. Intenta crear un usuario manualmente en el Dashboard de Supabase primero.';
    ELSE
        RAISE NOTICE 'Reparando con ID: %', v_instance_id;
        
        -- Reparar todos los usuarios demo
        UPDATE auth.users 
        SET instance_id = v_instance_id,
            email_confirmed_at = now()
        WHERE (email LIKE '%@demo.com' OR email LIKE '%@nemia.com' OR email LIKE '%@test.com');
    END IF;
END $$;

-- 3. Limpiar tabla de perfiles para evitar conflictos de llave duplicada
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000000';

-- 4. Re-habilitar trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

RAISE NOTICE 'Listo. Intenta entrar de nuevo.';
