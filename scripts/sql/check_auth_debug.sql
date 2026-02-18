-- SCRIPT DE DIAGNÓSTICO DE AUTENTICACIÓN
-- Ejecutar en SQL Editor de Supabase Dashbaord

-- 1. Verificar si los usuarios existen y su estado
SELECT 
    id, 
    email, 
    role, 
    aud, 
    email_confirmed_at, 
    instance_id, 
    btrim(encrypted_password) as password_hash_start
FROM auth.users
WHERE email LIKE '%@demo.com';

-- 2. Verificar si tienen Tenant asignado en perfiles
SELECT 
    p.id, 
    u.email, 
    p.tenant_id, 
    t.name as tenant_name
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
LEFT JOIN public.tenants t ON p.tenant_id = t.id
WHERE u.email LIKE '%@demo.com';

-- 3. Verificar si la extensión pgcrypto está activa
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
