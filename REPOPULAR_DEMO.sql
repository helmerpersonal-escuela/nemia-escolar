-- ======================================================
-- POBLACIÓN FORZADA DE DATOS DEMO (NEMIA) - V5 COMPLETA
-- ======================================================

-- 1. Arreglar restricción de roles
ALTER TABLE public.profile_roles DROP CONSTRAINT IF EXISTS profile_roles_check;
ALTER TABLE public.profile_roles ADD CONSTRAINT profile_roles_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT', 'INDEPENDENT_TEACHER'));

-- 2. Asegurar columna is_demo
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;

-- 3. Inquilino (Tenant) y Ciclo Escolar
INSERT INTO public.tenants (id, name, type, onboarding_completed)
VALUES ('77777777-7777-7777-7777-777777777777', 'Escuela Demo NEMIA', 'INDEPENDENT', true)
ON CONFLICT (id) DO UPDATE SET onboarding_completed = true, name = 'Escuela Demo NEMIA';

INSERT INTO public.academic_years (id, tenant_id, name, start_date, end_date, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'Ciclo 2024-2025', '2024-09-01', '2025-07-31', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

-- 4. Vincular a los usuarios y marcar como DEMO
UPDATE public.profiles 
SET tenant_id = '77777777-7777-7777-7777-777777777777',
    profile_setup_completed = true,
    role = 'INDEPENDENT_TEACHER',
    is_demo = true,
    first_name = 'Demo',
    full_name = 'Profesor Demo NEMIA'
WHERE id IN (SELECT id FROM auth.users WHERE email IN ('usuario@prueba.com', 'test@nemia.com', 'demo.nemia@test.com'));

-- 5. Grupos
INSERT INTO public.groups (id, tenant_id, academic_year_id, grade, section, shift)
VALUES ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888', '1', 'A', 'MORNING')
ON CONFLICT (id) DO NOTHING;

-- 6. Obtener IDs de Materias Existentes y Limpiar Referencias
DELETE FROM public.group_subjects WHERE tenant_id = '77777777-7777-7777-7777-777777777777';

-- Las materias ya existen en subject_catalog, solo necesitamos sus IDs
-- No intentamos insertar ni actualizar para evitar conflictos de FK

-- 7. Vincular Materias al Grupo
INSERT INTO public.group_subjects (tenant_id, group_id, subject_catalog_id, teacher_id)

SELECT 
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    sc.id,
    p.id
FROM public.subject_catalog sc, public.profiles p
WHERE sc.name IN ('Español', 'Matemáticas', 'Ciencias')
AND sc.educational_level = 'SECONDARY'
AND p.tenant_id = '77777777-7777-7777-7777-777777777777'
AND p.role = 'INDEPENDENT_TEACHER';

-- 8. Alumnos
DELETE FROM public.students WHERE tenant_id = '77777777-7777-7777-7777-777777777777';
INSERT INTO public.students (tenant_id, group_id, first_name, last_name_paternal, gender) VALUES 
('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'Juan', 'Pérez', 'HOMBRE'),
('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'María', 'García', 'MUJER'),
('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'Carlos', 'Rodríguez', 'HOMBRE'),
('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'Ana', 'Martínez', 'MUJER');

-- 9. Programa Analítico
-- Asegurar que la restricción permite 'COMPLETED'
ALTER TABLE public.analytical_programs DROP CONSTRAINT IF EXISTS analytical_programs_status_check;
ALTER TABLE public.analytical_programs ADD CONSTRAINT analytical_programs_status_check CHECK (status IN ('DRAFT', 'COMPLETED'));

INSERT INTO public.analytical_programs (id, tenant_id, academic_year_id, group_id, subject_id, diagnosis_context, problem_statements, status)
SELECT 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '77777777-7777-7777-7777-777777777777',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    sc.id,
    'Diagnóstico socioeducativo: Se observa un rezago en comprensión lectora...',
    '[{"id": "p1", "description": "Falta de comprensión de ideas principales", "priority": "ALTA"}]'::jsonb,
    'COMPLETED'
FROM public.subject_catalog sc
WHERE sc.name = 'Español' AND sc.educational_level = 'SECONDARY'
ON CONFLICT (id) DO NOTHING;

-- 10. Planeación Didáctica
-- Planeación 1: Español
INSERT INTO public.lesson_plans (id, tenant_id, group_id, subject_id, title, temporality, start_date, end_date, metodologia, problem_context, status, objectives)
SELECT 
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    sc.id,
    'Planeación Demo: Comprensión Lectora',
    'MONTHLY',
    '2024-11-01',
    '2024-11-30',
    'ABP',
    'Contexto: Los alumnos requieren estrategias para sintetizar información.',
    'APPROVED',
    '["Mejorar fluidez lectora", "Identificar tipos de texto"]'::jsonb
FROM public.subject_catalog sc
WHERE sc.name = 'Español' AND sc.educational_level = 'SECONDARY'
ON CONFLICT (id) DO NOTHING;

-- Planeación 2: Matemáticas
INSERT INTO public.lesson_plans (id, tenant_id, group_id, subject_id, title, temporality, start_date, end_date, metodologia, problem_context, status, objectives)
SELECT 
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    sc.id,
    'Planeación Demo: Resolución de Ecuaciones',
    'MONTHLY',
    '2024-11-01',
    '2024-11-30',
    'STEAM',
    'Contexto: Los alumnos tienen dificultades con el lenguaje algebraico.',
    'APPROVED',
    '["Resolver ecuaciones lineales", "Modelar situaciones reales"]'::jsonb
FROM public.subject_catalog sc
WHERE sc.name = 'Matemáticas' AND sc.educational_level = 'SECONDARY'
ON CONFLICT (id) DO NOTHING;


-- 11. Horario de Docentes (Schedules)
DELETE FROM public.schedules WHERE tenant_id = '77777777-7777-7777-7777-777777777777';
INSERT INTO public.schedules (tenant_id, group_id, subject_id, day_of_week, start_time, end_time)
SELECT '77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', sc.id, day, start_t, end_t
FROM public.subject_catalog sc
CROSS JOIN (VALUES 
    ('Español', 'MONDAY', '07:00:00'::time, '08:40:00'::time),
    ('Matemáticas', 'MONDAY', '08:40:00'::time, '10:20:00'::time),
    ('Español', 'TUESDAY', '07:00:00'::time, '08:40:00'::time),
    ('Ciencias', 'TUESDAY', '08:40:00'::time, '10:20:00'::time),
    ('Matemáticas', 'WEDNESDAY', '07:00:00'::time, '08:40:00'::time),
    ('Ciencias', 'WEDNESDAY', '08:40:00'::time, '10:20:00'::time)
) AS schedule_data(subject_name, day, start_t, end_t)
WHERE sc.name = schedule_data.subject_name AND sc.educational_level = 'SECONDARY';

-- 12. Programa Sintético (Sample data for Editor)
INSERT INTO public.synthetic_program_contents (phase, educational_level, field_of_study, subject_name, content, pda)
VALUES 
(6, 'SECUNDARIA', 'Lenguajes', 'Español', 'La diversidad de lenguas y su uso en la comunicación familiar, escolar y comunitaria.', 'Reconoce la riqueza lingüística de México y el mundo, a partir de obras literarias procedentes de distintas culturas.'),
(6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Matemáticas', 'Expresión de fracciones como decimales y de decimales como fracciones.', 'Usa diversas estrategias al convertir números fraccionarios a decimales y viceversa.'),
(6, 'SECUNDARIA', 'Saberes y Pensamiento Científico', 'Ciencias', 'Unidades y medidas utilizados en Física.', 'Identifica las unidades de medición que se ocupan en su entorno escolar, familiar y en su comunidad.')
ON CONFLICT DO NOTHING;

-- 13. Configuraciones de Horario (Schedule Settings) para el Demo Tenant
INSERT INTO public.schedule_settings (tenant_id, start_time, end_time, module_duration, breaks)
VALUES ('77777777-7777-7777-7777-777777777777', '07:00:00', '14:00:00', 50, '[{"name": "Receso", "start_time": "10:20:00", "end_time": "10:50:00"}]'::jsonb)
ON CONFLICT (tenant_id) DO NOTHING;

-- 14. Periodos de Evaluación (Trimestres)
DELETE FROM public.evaluation_periods WHERE tenant_id = '77777777-7777-7777-7777-777777777777';
INSERT INTO public.evaluation_periods (id, tenant_id, name, start_date, end_date, is_active)
VALUES 
('dddddddd-dddd-dddd-dddd-dddddddddddd', '77777777-7777-7777-7777-777777777777', 'Primer Trimestre', '2024-09-01', '2024-11-30', false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '77777777-7777-7777-7777-777777777777', 'Segundo Trimestre', '2024-12-01', '2025-03-15', true),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-7777-7777-7777-777777777777', 'Tercer Trimestre', '2025-03-16', '2025-07-31', false);

-- 15. Criterios de Evaluación por Trimestre
DELETE FROM public.evaluation_criteria WHERE tenant_id = '77777777-7777-7777-7777-777777777777';
INSERT INTO public.evaluation_criteria (tenant_id, period_id, group_id, name, percentage, description)
VALUES 
-- Primer Trimestre
('77777777-7777-7777-7777-777777777777', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '99999999-9999-9999-9999-999999999999', 'Exámenes', 40.00, 'Evaluaciones escritas y orales'),
('77777777-7777-7777-7777-777777777777', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '99999999-9999-9999-9999-999999999999', 'Tareas', 30.00, 'Trabajos y ejercicios en casa'),
('77777777-7777-7777-7777-777777777777', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '99999999-9999-9999-9999-999999999999', 'Participación', 20.00, 'Intervenciones en clase'),
('77777777-7777-7777-7777-777777777777', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '99999999-9999-9999-9999-999999999999', 'Proyecto', 10.00, 'Trabajo colaborativo'),
-- Segundo Trimestre (activo)
('77777777-7777-7777-7777-777777777777', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999999', 'Exámenes', 40.00, 'Evaluaciones escritas y orales'),
('77777777-7777-7777-7777-777777777777', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999999', 'Tareas', 30.00, 'Trabajos y ejercicios en casa'),
('77777777-7777-7777-7777-777777777777', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999999', 'Participación', 20.00, 'Intervenciones en clase'),
('77777777-7777-7777-7777-777777777777', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999999', 'Proyecto', 10.00, 'Trabajo colaborativo'),
-- Tercer Trimestre
('77777777-7777-7777-7777-777777777777', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999999', 'Exámenes', 40.00, 'Evaluaciones escritas y orales'),
('77777777-7777-7777-7777-777777777777', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999999', 'Tareas', 30.00, 'Trabajos y ejercicios en casa'),
('77777777-7777-7777-7777-777777777777', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999999', 'Participación', 20.00, 'Intervenciones en clase'),
('77777777-7777-7777-7777-777777777777', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999999', 'Proyecto', 10.00, 'Trabajo colaborativo');

-- 16. Actividades/Asignaciones (Recibidas y Por Recibir)
DELETE FROM public.assignments WHERE tenant_id = '77777777-7777-7777-7777-777777777777';

-- Usar CTE para obtener los IDs de las materias
WITH subject_ids AS (
    SELECT id, name FROM public.subject_catalog 
    WHERE educational_level = 'SECONDARY' AND name IN ('Español', 'Matemáticas', 'Ciencias')
)
INSERT INTO public.assignments (id, tenant_id, group_id, subject_id, title, description, due_date, type, weighting_percentage)
SELECT id_val, '77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 
       (SELECT id FROM subject_ids WHERE name = subject_name), 
       title, description, due_date, type, weighting
FROM (VALUES 
    -- Actividades RECIBIDAS (pasadas)
    ('a1111111-1111-1111-1111-111111111111'::uuid, 'Español', 'Ensayo sobre la Revolución Mexicana', 'Redactar un ensayo de 2 páginas', '2024-10-15 23:59:00'::timestamp, 'HOMEWORK', 15.00),
    ('a2222222-2222-2222-2222-222222222222'::uuid, 'Matemáticas', 'Examen de Álgebra', 'Ecuaciones lineales y cuadráticas', '2024-11-20 10:00:00'::timestamp, 'EXAM', 40.00),
    ('a3333333-3333-3333-3333-333333333333'::uuid, 'Ciencias', 'Proyecto de Física', 'Construcción de un péndulo simple', '2024-11-25 23:59:00'::timestamp, 'PROJECT', 10.00),
    -- Actividades POR RECIBIR (futuras)
    ('a4444444-4444-4444-4444-444444444444'::uuid, 'Español', 'Análisis de texto literario', 'Identificar figuras retóricas en un poema', '2025-02-28 23:59:00'::timestamp, 'HOMEWORK', 15.00),
    ('a5555555-5555-5555-5555-555555555555'::uuid, 'Matemáticas', 'Examen de Geometría', 'Teorema de Pitágoras y áreas', '2025-03-10 10:00:00'::timestamp, 'EXAM', 40.00),
    ('a6666666-6666-6666-6666-666666666666'::uuid, 'Ciencias', 'Experimento de Química', 'Reacciones ácido-base', '2025-03-15 23:59:00'::timestamp, 'PROJECT', 10.00)
) AS assignments_data(id_val, subject_name, title, description, due_date, type, weighting);

-- 17. Calificaciones (solo para actividades recibidas)
DELETE FROM public.grades WHERE tenant_id = '77777777-7777-7777-7777-777777777777';
INSERT INTO public.grades (tenant_id, assignment_id, student_id, score, feedback, is_graded, graded_at)
SELECT 
    '77777777-7777-7777-7777-777777777777',
    a.id,
    s.id,
    CASE 
        WHEN a.id = 'a1111111-1111-1111-1111-111111111111' THEN (RANDOM() * 2 + 8)::NUMERIC(5,2) -- 8-10
        WHEN a.id = 'a2222222-2222-2222-2222-222222222222' THEN (RANDOM() * 3 + 7)::NUMERIC(5,2) -- 7-10
        WHEN a.id = 'a3333333-3333-3333-3333-333333333333' THEN (RANDOM() * 2 + 8)::NUMERIC(5,2) -- 8-10
    END,
    'Buen trabajo',
    true,
    NOW() - INTERVAL '10 days'
FROM public.students s
CROSS JOIN public.assignments a
WHERE s.tenant_id = '77777777-7777-7777-7777-777777777777'
AND a.id IN ('a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333')
ON CONFLICT (assignment_id, student_id) DO NOTHING;

-- 18. Asistencia Retrospectiva (último mes)
DELETE FROM public.attendance WHERE tenant_id = '77777777-7777-7777-7777-777777777777';
INSERT INTO public.attendance (tenant_id, group_id, student_id, date, status, notes)
SELECT 
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    s.id,
    d.date,
    CASE 
        WHEN RANDOM() < 0.85 THEN 'PRESENT'
        WHEN RANDOM() < 0.95 THEN 'LATE'
        ELSE 'ABSENT'
    END,
    NULL
FROM public.students s
CROSS JOIN (
    SELECT date::date
    FROM generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '1 day',
        '1 day'::interval
    ) AS date
    WHERE EXTRACT(DOW FROM date) NOT IN (0, 6) -- Excluir sábados y domingos
) d
WHERE s.tenant_id = '77777777-7777-7777-7777-777777777777'
ON CONFLICT (student_id, date, group_id) DO NOTHING;
