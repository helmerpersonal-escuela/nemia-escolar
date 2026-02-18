-- ⚠️ ADVERTENCIA CRÍTICA: ESTE SCRIPT ELIMINA TODA LA INFORMACIÓN DEL SISTEMA ⚠️
-- Úsalo únicamente para limpiar la base de datos antes del lanzamiento oficial.

DO $$
BEGIN

    -- 1. Limpiar Tablas Transaccionales (Diario)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_attendance') THEN
        DELETE FROM "staff_attendance";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_records') THEN
        DELETE FROM "attendance_records";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'grades') THEN
        DELETE FROM "grades";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'evaluations') THEN
        DELETE FROM "evaluations";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lesson_plans') THEN
        DELETE FROM "lesson_plans";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analytical_programs') THEN
        DELETE FROM "analytical_programs";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        DELETE FROM "notifications";
    END IF;

    -- 2. Limpiar Estructura Académica (Configuración)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schedules') THEN
        DELETE FROM "schedules";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_subjects') THEN
        DELETE FROM "group_subjects";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'groups') THEN
        DELETE FROM "groups";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_years') THEN
        DELETE FROM "academic_years";
    END IF;

    -- 3. Limpiar Personas y Perfiles
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'students') THEN
        DELETE FROM "students";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_commissions') THEN
        DELETE FROM "staff_commissions";
    END IF;
    
    -- 4. Limpiar Organización Principal
    -- Al borrar los perfiles y tenants, se desvinculan los usuarios.
    -- NOTA: Los usuarios en Auth (correo/pass) deben borrarse manualmente en el panel de Supabase.
    
    -- Profiles y Tenants son tablas core, deberían existir, pero validamos por seguridad.
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        DELETE FROM "profiles";
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
        DELETE FROM "tenants";
    END IF;

END $$;

-- EL CATÁLOGO DE MATERIAS (subject_catalog) SE MANTIENE INTACTO PARA SU USO GENERAL.
