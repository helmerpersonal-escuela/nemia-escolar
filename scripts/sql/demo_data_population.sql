-- ======================================================
-- SCRIPT DE POBLACIÓN DE DATOS DEMO (NEMIA) - V6 FINAL
-- NO BLOCKS, NO DOLLARS, NO VARIABLES
-- ======================================================

-- 1. Arreglar restricción de roles (Crítico)
ALTER TABLE public.profile_roles DROP CONSTRAINT IF EXISTS profile_roles_check;
ALTER TABLE public.profile_roles ADD CONSTRAINT profile_roles_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT', 'INDEPENDENT_TEACHER'));

-- 2. Asegurar columna is_demo
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;

-- 3. Inquilino (Tenant) Demo
INSERT INTO public.tenants (id, name, type, onboarding_completed)
VALUES ('77777777-7777-7777-7777-777777777777', 'DEMO: Profesor Independiente', 'INDEPENDENT', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Ciclo Escolar
INSERT INTO public.academic_years (id, tenant_id, name, start_date, end_date, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'Ciclo Demo 2025', '2025-01-01', '2025-12-31', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Usuario Demo (Auth)
-- Email: demo.nemia@test.com | Pass: nemia123
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, created_at, updated_at, 
    raw_app_meta_data, raw_user_meta_data, 
    confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000', 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 'authenticated', 'demo.nemia@test.com', 
    '$2a$10$7RmszB.V3.v4yA7v2B8Q6.Y.m/0Y.6vjGvL8Z9e5K.1y4rY.yv8.', 
    now(), now(), now(), 
    '{"provider":"email","providers":["email"]}', '{}', 
    '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- 6. Perfil Demo
INSERT INTO public.profiles (id, tenant_id, role, first_name, full_name, is_demo, profile_setup_completed)
VALUES (
    '00000000-0000-0000-0000-000000000000', 
    '77777777-7777-7777-7777-777777777777', 
    'INDEPENDENT_TEACHER', 
    'Demo', 
    'Profesor Demo NEMIA', 
    true, 
    true
)
ON CONFLICT (id) DO UPDATE SET 
    is_demo = true, 
    tenant_id = '77777777-7777-7777-7777-777777777777', 
    role = 'INDEPENDENT_TEACHER';

-- 7. Roles del Perfil (Ahora con la restricción arreglada)
INSERT INTO public.profile_roles (profile_id, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'INDEPENDENT_TEACHER')
ON CONFLICT (profile_id, role) DO NOTHING;

-- 8. Grupo Demo
INSERT INTO public.groups (id, tenant_id, academic_year_id, grade, section, shift)
VALUES (
    '99999999-9999-9999-9999-999999999999', 
    '77777777-7777-7777-7777-777777777777', 
    '88888888-8888-8888-8888-888888888888', 
    '1', 'A', 'MORNING'
) ON CONFLICT (id) DO NOTHING;

-- 9. Alumnos
INSERT INTO public.students (tenant_id, group_id, first_name, last_name_paternal, gender) VALUES 
('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'Juan', 'Pérez', 'HOMBRE'),
('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'María', 'García', 'MUJER');

-- 10. Planeación
INSERT INTO public.lesson_plans (id, tenant_id, teacher_id, group_id, subject, topic, status, content)
VALUES (
    gen_random_uuid(),
    '77777777-7777-7777-7777-777777777777', 
    '00000000-0000-0000-0000-000000000000', 
    '99999999-9999-9999-9999-999999999999', 
    'Matemáticas', 
    'Fracciones', 
    'PUBLISHED', 
    '{"activities": [{"name": "Ejercicio 1", "status": "COMPLETED"}]}'
);

-- 11. Horario
INSERT INTO public.schedules (id, tenant_id, group_id, day_of_week, start_time, end_time)
VALUES (
    gen_random_uuid(),
    '77777777-7777-7777-7777-777777777777', 
    '99999999-9999-9999-9999-999999999999', 
    'MONDAY', 
    '08:00:00', 
    '10:00:00'
);
