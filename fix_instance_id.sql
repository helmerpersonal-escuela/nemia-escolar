-- SCRIPT: REPARACIÓN FORZADA DE INSTANCIA (Fix NULL instance_id)
-- Ejecuta esto para quitar el NULL que bloquea tu login.

DO $$
DECLARE
    v_real_id UUID;
BEGIN
    -- 1. Intentar obtener el ID real de la instancia
    SELECT id INTO v_real_id FROM auth.instances LIMIT 1;

    -- 2. Si no hay nada en auth.instances, usar el ID por defecto de Supabase
    IF v_real_id IS NULL THEN
        v_real_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    RAISE NOTICE 'Sincronizando con Instance ID: %', v_real_id;

    -- 3. Actualizar al usuario
    UPDATE auth.users 
    SET instance_id = v_real_id
    WHERE email = 'helmerpersonal@gmail.com';

    -- 4. Asegurar que no sea NULL (Resguardo final)
    UPDATE auth.users 
    SET instance_id = '00000000-0000-0000-0000-000000000000'
    WHERE email = 'helmerpersonal@gmail.com' AND instance_id IS NULL;

END $$;

-- Verificación final
SELECT id, email, instance_id FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
