-- ==========================================
-- SCRIPT DE LIMPIEZA PROFUNDA (NUCLEAR)
-- ==========================================
-- Advertencia: Elimina usuarios, perfiles, tenants y datos asociados.
-- Ejecutar en SQL Editor de Supabase.

BEGIN;

-- 1. Limpiar Tablas de Datos (Cascada inversa)
DELETE FROM public.student_incidents;
DELETE FROM public.assignments;
DELETE FROM public.lesson_plans;
DELETE FROM public.students;
DELETE FROM public.groups;
DELETE FROM public.academic_years;

-- 2. Limpiar Estructura Principal
DELETE FROM public.staff_invitations;
DELETE FROM public.profile_roles;
DELETE FROM public.profiles;
DELETE FROM public.tenants;

-- 3. Limpiar Usuarios (Auth) - Intentar borrar todos menos el actual (si es posible)
-- Nota: En Supabase Dashboard esto suele permitirse. Si falla, el usuario deberá borrar manualmente en Auth > Users.
DELETE FROM auth.users WHERE email LIKE '%@demo.com';

-- 4. Recrear Escuela Demo (Limpia)
INSERT INTO public.tenants (id, name, type, onboarding_completed, created_at)
VALUES (
    'd0000000-0000-4000-a000-000000000000', 
    'Instituto Nuevo Horizonte (Demo)', 
    'SCHOOL', 
    true, 
    now()
);

-- 5. Crear Ciclo Escolar 2025-2026 (Vital para Dashboard)
INSERT INTO public.academic_years (tenant_id, name, start_date, end_date, is_active)
VALUES (
    'd0000000-0000-4000-a000-000000000000', 
    'Ciclo Escolar 2025-2026', 
    '2025-08-26', 
    '2026-07-16', 
    true
);

COMMIT;

-- 6. Mensaje Final
-- Instrucción: Después de esto, crea tu usuario MANUALMENTE en el dashboard y corre el script de vinculación.
