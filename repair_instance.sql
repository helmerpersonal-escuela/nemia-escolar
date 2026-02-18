-- SCRIPT: REPARACIÓN DE INSTANCIA (The Vital Organ)
-- Restaura el registro perdido en auth.instances que causa el Error 500.

BEGIN;

-- 1. Insertar la instancia por defecto (Ceros es el estándar de Supabase GoTrue)
-- Usamos 'ON CONFLICT' por si acaso hubiera vuelto a aparecer.
INSERT INTO auth.instances (id, updated_at, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Vincular a tu usuario a esta instancia
-- Sin esto, Supabase cree que el usuario no pertenece a este proyecto.
UPDATE auth.users 
SET instance_id = '00000000-0000-0000-0000-000000000000'
WHERE email = 'helmerpersonal@gmail.com';

-- 3. Limpiar cualquier basura en identidades
UPDATE auth.identities
SET identity_data = jsonb_build_object('sub', id, 'email', 'helmerpersonal@gmail.com')
WHERE email = 'helmerpersonal@gmail.com';

COMMIT;

-- Verificación final (Debe salir 1 fila)
SELECT id as ID_DE_INSTANCIA_RECUPERADO FROM auth.instances;
SELECT email, instance_id FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
