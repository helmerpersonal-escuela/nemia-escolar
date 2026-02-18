-- SCRIPT: REPARACIÓN DE IDENTIDAD Y PROVEEDOR (The 500 Killer)
-- Arregla el provider_id que debe ser el email para el proveedor 'email'.

DO $$
DECLARE
    v_instance_id UUID;
    v_user_id UUID;
    v_email TEXT := 'helmerpersonal@gmail.com';
BEGIN
    -- 1. Obtener el ID real de la instancia (No siempre es ceros)
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
    
    -- 2. Obtener el ID del usuario
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Usuario % no encontrado. Ejecuta primero el script de creación.', v_email;
        RETURN;
    END IF;

    -- 3. Corregir Instance ID en auth.users
    UPDATE auth.users SET instance_id = v_instance_id WHERE id = v_user_id;

    -- 4. ¡CRÍTICO!: Corregir Identity
    -- Para el proveedor 'email', el provider_id DEBE ser el email del usuario.
    -- Si tiene un UUID ahí, Supabase Auth da error 500.
    UPDATE auth.identities 
    SET provider_id = v_email,
        identity_data = jsonb_build_object('sub', v_user_id, 'email', v_email)
    WHERE user_id = v_user_id AND provider = 'email';

    RAISE NOTICE 'Sincronización completada para %', v_email;
    RAISE NOTICE 'Instance ID usado: %', v_instance_id;
END $$;

-- Verificación final
SELECT id, email, instance_id FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
SELECT * FROM auth.identities WHERE email = 'helmerpersonal@gmail.com';
