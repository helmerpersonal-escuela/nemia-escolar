-- Seed Data for Demo School (Robust Schema + Data + Constraints)
-- This script ensures the schema is correct before seeding data.
-- Handles:
-- 1. Missing columns in existing tables (analytical_programs, lesson_plans).
-- 2. Missing UNIQUE constraints on 'attendance' and 'grades' for ON CONFLICT.
-- 3. on_auth_user_created trigger side usage.
-- 4. Idempotent insertion of Tenant, Users, and Academic Data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

---------------------------------------------------------------------------
-- 0. SCHEMA FIXES (Ensure columns & constraints exist)
---------------------------------------------------------------------------
DO $$
BEGIN
    -- analytical_programs: group_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'group_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
    END IF;

    -- analytical_programs: subject_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'subject_id') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL;
    END IF;

    -- analytical_programs: status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'status') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED'));
    END IF;

    -- analytical_programs: diagnosis_context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytical_programs' AND column_name = 'diagnosis_context') THEN
        ALTER TABLE public.analytical_programs ADD COLUMN diagnosis_context TEXT;
    END IF;
    
    -- lesson_plans: period_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'period_id') THEN
         ALTER TABLE public.lesson_plans ADD COLUMN period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL;
    END IF;
    
    -- lesson_plans: temporality
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'temporality') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN temporality TEXT CHECK (temporality IN ('WEEKLY', 'MONTHLY', 'PROJECT'));
    END IF;

    -- lesson_plans: start_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'start_date') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN start_date DATE;
    END IF;

    -- lesson_plans: end_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'end_date') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN end_date DATE;
    END IF;

    -- lesson_plans: metodologia
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'metodologia') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN metodologia TEXT;
    END IF;
    
    -- lesson_plans: problem_context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'problem_context') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN problem_context TEXT;
    END IF;

    -- lesson_plans: status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'status') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED'));
    END IF;

    -- grades: unique(assignment_id, student_id)
    -- This constraint name is usually auto-generated if created via CREATE TABLE with UNIQUE(...)
    -- but we specifically need check if it exists so ON CONFLICT works.
    -- We'll just define a key name and add it if missing.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.grades'::regclass 
        AND contype = 'u' 
        AND conname = 'grades_assignment_student_unique'
    ) AND NOT EXISTS (
        -- Also check for generic 'grades_assignment_id_student_id_key' or similar just in case
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.grades'::regclass 
        AND contype = 'u'
        AND array_to_string(conkey, ',') IN (
            array_to_string(ARRAY(
                SELECT attnum FROM pg_attribute WHERE attrelid = 'public.grades'::regclass AND attname IN ('assignment_id', 'student_id') ORDER BY attname
            ), ','),
             array_to_string(ARRAY(
                SELECT attnum FROM pg_attribute WHERE attrelid = 'public.grades'::regclass AND attname IN ('student_id', 'assignment_id') ORDER BY attname
            ), ',')
        )
    ) THEN
        -- Safest: explicitly ADD it with a known name ensuring no duplicates
        -- But wait, checking complex array matches is hard. Let's just TRY ADD with known name.
        BEGIN
            ALTER TABLE public.grades ADD CONSTRAINT grades_assignment_student_unique UNIQUE (assignment_id, student_id);
        EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
        END;
    END IF;

    -- attendance: unique(student_id, date, group_id)
    -- We can just execute in a block catching exception.
    BEGIN
        ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_date_group_unique UNIQUE (student_id, date, group_id);
    EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; -- constraint already exists
    END;

END $$;

---------------------------------------------------------------------------
-- 1. DATA SEEDING
---------------------------------------------------------------------------
DO $$
DECLARE
    -- IDs
    v_tenant_id uuid;
    v_year_id uuid;
    v_user_id uuid;
    v_temp_tenant_id uuid;
    v_profile_id uuid;
    v_group_id uuid;
    v_subject_id uuid;
    v_student_id uuid;
    v_assignment_id uuid;
    v_program_id uuid;
    
    -- Counters & Loops
    i integer;
    j integer;
    k integer;
    
    -- Config
    v_password text := '123456';
    v_encrypted_pw text;
    v_exists boolean;
    
    -- Arrays for Random Data
    a_first_names text[] := ARRAY['Juan', 'María', 'Pedro', 'Ana', 'Luis', 'Sofia', 'Carlos', 'Lucía', 'Miguel', 'Elena', 'José', 'Daniela', 'David', 'Fernanda', 'Javier', 'Carmen', 'Francisco', 'Adriana', 'Manuel', 'Paty'];
    a_last_names text[] := ARRAY['García', 'Rodríguez', 'Hernández', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes', 'Gutiérrez', 'Ortiz', 'Castillo'];
    
    -- Subjects
    v_tech_subjects text[] := ARRAY['Agricultura', 'Ganadería', 'Apicultura', 'Informática', 'Estructuras Metálicas', 'PCIA'];
    v_general_subjects text[] := ARRAY['Español', 'Inglés', 'Matemáticas', 'Ciencias (Biología)', 'Ciencias (Física)', 'Ciencias (Química)', 'Historia', 'Geografía', 'Formación Cívica y Ética', 'Artes', 'Educación Física', 'Tecnología'];
    
    -- Group Tracking
    v_groups_ids uuid[];
    v_students_ids uuid[];
    
BEGIN
    -- 0. Prepare Password
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

    -- 1. Create Tenant (Idempotent check)
    SELECT id INTO v_tenant_id FROM public.tenants WHERE name = 'Escuela Secundaria Técnica Demo' LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        INSERT INTO public.tenants (name, type) 
        VALUES ('Escuela Secundaria Técnica Demo', 'SCHOOL') 
        RETURNING id INTO v_tenant_id;
        RAISE NOTICE 'Created Tenant: %', v_tenant_id;
    ELSE
        RAISE NOTICE 'Using Existing Tenant: %', v_tenant_id;
    END IF;

    -- 2. Create Academic Year
    SELECT id INTO v_year_id FROM public.academic_years WHERE tenant_id = v_tenant_id AND name = '2025-2026' LIMIT 1;
    
    IF v_year_id IS NULL THEN
        INSERT INTO public.academic_years (tenant_id, name, start_date, end_date, is_active)
        VALUES (v_tenant_id, '2025-2026', '2025-08-26', '2026-07-16', true)
        RETURNING id INTO v_year_id;
    END IF;
    
    ---------------------------------------------------------------------------
    -- 3. STAFF CREATION
    -- Function to create user & fix tenant association
    ---------------------------------------------------------------------------
    
    -- 3.1 Director
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'director@demo.com';
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'director@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Director', 'lastNamePaternal', 'General', 'mode', 'INDEPENDENT'), now(), now());
        
        -- Trigger ran here created a profile with WRONG tenant. Fix it!
        -- Find the tenant created for this user (if any) and delete it after updating profile
        SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
        
        UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'DIRECTOR' WHERE id = v_user_id;
        
        -- Clean up temp tenant if not matched
        IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN
            DELETE FROM public.tenants WHERE id = v_temp_tenant_id;
        END IF;
    ELSE
        -- Just ensure role/tenant is correct
        UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'DIRECTOR' WHERE id = v_user_id;
    END IF;
    INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'DIRECTOR') ON CONFLICT (profile_id, role) DO NOTHING;

    -- 3.2 Subdirector
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'subdirector@demo.com';
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'subdirector@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Subdirector', 'lastNamePaternal', 'Operativo', 'mode', 'INDEPENDENT'), now(), now());
        
        SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
        UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'DIRECTOR' WHERE id = v_user_id; -- Role DIRECTOR used as placeholder for administrative access
        IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN DELETE FROM public.tenants WHERE id = v_temp_tenant_id; END IF;
    ELSE
        UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'DIRECTOR' WHERE id = v_user_id;
    END IF;
    INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'DIRECTOR') ON CONFLICT (profile_id, role) DO NOTHING;

    -- 3.3 Acad Coord
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'coord.acad@demo.com';
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coord.acad@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Coordinador', 'lastNamePaternal', 'Académico', 'mode', 'INDEPENDENT'), now(), now());
        
        SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
        UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'ACADEMIC_COORD' WHERE id = v_user_id;
        IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN DELETE FROM public.tenants WHERE id = v_temp_tenant_id; END IF;
    ELSE
         UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'ACADEMIC_COORD' WHERE id = v_user_id;
    END IF;
    INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'ACADEMIC_COORD') ON CONFLICT (profile_id, role) DO NOTHING;

    -- 3.4 Tech Coord
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'coord.tech@demo.com';
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coord.tech@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Coordinador', 'lastNamePaternal', 'Tecnologías', 'mode', 'INDEPENDENT'), now(), now());
        
        SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
        UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'TECH_COORD' WHERE id = v_user_id;
        IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN DELETE FROM public.tenants WHERE id = v_temp_tenant_id; END IF;
    ELSE
         UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'TECH_COORD' WHERE id = v_user_id;
    END IF;
    INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'TECH_COORD') ON CONFLICT (profile_id, role) DO NOTHING;

    -- 3.5 Prefects (2)
    FOR i IN 1..2 LOOP
        SELECT id INTO v_user_id FROM auth.users WHERE email = 'prefecto' || i || '@demo.com';
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
            VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prefecto' || i || '@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Prefecto', 'lastNamePaternal', CAST(i AS text), 'mode', 'INDEPENDENT'), now(), now());
            
            SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
            UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'PREFECT' WHERE id = v_user_id;
            IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN DELETE FROM public.tenants WHERE id = v_temp_tenant_id; END IF;
        ELSE
             UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'PREFECT' WHERE id = v_user_id;
        END IF;
        INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'PREFECT') ON CONFLICT (profile_id, role) DO NOTHING;
    END LOOP;

    -- 3.6 Control Escolar (3)
    FOR i IN 1..3 LOOP
        SELECT id INTO v_user_id FROM auth.users WHERE email = 'control' || i || '@demo.com';
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
            VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'control' || i || '@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Control', 'lastNamePaternal', CAST(i AS text), 'mode', 'INDEPENDENT'), now(), now());
            
            SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
            UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'SCHOOL_CONTROL' WHERE id = v_user_id;
            IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN DELETE FROM public.tenants WHERE id = v_temp_tenant_id; END IF;
        ELSE
            UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'SCHOOL_CONTROL' WHERE id = v_user_id;
        END IF;
        INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'SCHOOL_CONTROL') ON CONFLICT (profile_id, role) DO NOTHING;
    END LOOP;

    -- 3.7 Trabajo Social
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'tsocial@demo.com';
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tsocial@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Trabajo', 'lastNamePaternal', 'Social', 'mode', 'INDEPENDENT'), now(), now());
        
        SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
        UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'SUPPORT' WHERE id = v_user_id;
        IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN DELETE FROM public.tenants WHERE id = v_temp_tenant_id; END IF;
    ELSE
         UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'SUPPORT' WHERE id = v_user_id;
    END IF;
   INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'SUPPORT') ON CONFLICT (profile_id, role) DO NOTHING;


    ---------------------------------------------------------------------------
    -- 4. TEACHERS & SUBJECTS
    ---------------------------------------------------------------------------
    
    -- 4.1 Technology Teachers (6)
    FOR i IN 1..6 LOOP
        SELECT id INTO v_user_id FROM auth.users WHERE email = 'docente.tecnologia' || i || '@demo.com';
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
            VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'docente.tecnologia' || i || '@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Docente', 'lastNamePaternal', v_tech_subjects[i], 'mode', 'INDEPENDENT'), now(), now());
            
            SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
            UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'TEACHER' WHERE id = v_user_id;
            IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN DELETE FROM public.tenants WHERE id = v_temp_tenant_id; END IF;
        ELSE
            UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'TEACHER' WHERE id = v_user_id;
        END IF;
        
        INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'TEACHER') ON CONFLICT (profile_id, role) DO NOTHING;
        
        -- Assign Technology Subject
        SELECT id INTO v_subject_id FROM public.subject_catalog WHERE name = 'Tecnología' LIMIT 1;
        IF v_subject_id IS NOT NULL THEN
            INSERT INTO public.profile_subjects (profile_id, tenant_id, subject_catalog_id, custom_detail)
            VALUES (v_user_id, v_tenant_id, v_subject_id, v_tech_subjects[i]) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- 4.2 General Teachers (18)
    FOR i IN 1..18 LOOP
        SELECT id INTO v_user_id FROM auth.users WHERE email = 'docente.general' || i || '@demo.com';
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
            VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'docente.general' || i || '@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Docente', 'lastNamePaternal', 'General ' || i, 'mode', 'INDEPENDENT'), now(), now());
            
            SELECT tenant_id INTO v_temp_tenant_id FROM public.profiles WHERE id = v_user_id;
            UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'TEACHER' WHERE id = v_user_id;
            IF v_temp_tenant_id IS NOT NULL AND v_temp_tenant_id != v_tenant_id THEN DELETE FROM public.tenants WHERE id = v_temp_tenant_id; END IF;
        ELSE
             UPDATE public.profiles SET tenant_id = v_tenant_id, role = 'TEACHER' WHERE id = v_user_id;
        END IF;
        
        INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'TEACHER') ON CONFLICT (profile_id, role) DO NOTHING;
         
         -- Assign random general subjects (2 per teacher)
         FOR j IN 1..2 LOOP
            SELECT id INTO v_subject_id FROM public.subject_catalog 
            WHERE name = v_general_subjects[floor(random() * array_length(v_general_subjects, 1) + 1)::int] 
            LIMIT 1;
            
            IF v_subject_id IS NOT NULL THEN
                INSERT INTO public.profile_subjects (profile_id, tenant_id, subject_catalog_id)
                VALUES (v_user_id, v_tenant_id, v_subject_id)
                ON CONFLICT DO NOTHING;
            END IF;
         END LOOP;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 5. GROUPS & STUDENTS & ACAD RECS
    ---------------------------------------------------------------------------
    
    -- Create Groups (Avoid duplicates)
    SELECT count(*) INTO i FROM public.groups WHERE tenant_id = v_tenant_id AND academic_year_id = v_year_id;
    IF i = 0 THEN
        INSERT INTO public.groups (tenant_id, academic_year_id, grade, section, shift) VALUES (v_tenant_id, v_year_id, '1', 'A', 'MORNING') RETURNING id INTO v_group_id; v_groups_ids := array_append(v_groups_ids, v_group_id);
        INSERT INTO public.groups (tenant_id, academic_year_id, grade, section, shift) VALUES (v_tenant_id, v_year_id, '1', 'B', 'MORNING') RETURNING id INTO v_group_id; v_groups_ids := array_append(v_groups_ids, v_group_id);
        INSERT INTO public.groups (tenant_id, academic_year_id, grade, section, shift) VALUES (v_tenant_id, v_year_id, '2', 'A', 'MORNING') RETURNING id INTO v_group_id; v_groups_ids := array_append(v_groups_ids, v_group_id);
        INSERT INTO public.groups (tenant_id, academic_year_id, grade, section, shift) VALUES (v_tenant_id, v_year_id, '2', 'B', 'MORNING') RETURNING id INTO v_group_id; v_groups_ids := array_append(v_groups_ids, v_group_id);
        INSERT INTO public.groups (tenant_id, academic_year_id, grade, section, shift) VALUES (v_tenant_id, v_year_id, '3', 'A', 'MORNING') RETURNING id INTO v_group_id; v_groups_ids := array_append(v_groups_ids, v_group_id);
        INSERT INTO public.groups (tenant_id, academic_year_id, grade, section, shift) VALUES (v_tenant_id, v_year_id, '3', 'B', 'MORNING') RETURNING id INTO v_group_id; v_groups_ids := array_append(v_groups_ids, v_group_id);
    ELSE
         -- Just get the IDs of existing groups
         SELECT array_agg(id) INTO v_groups_ids FROM public.groups WHERE tenant_id = v_tenant_id AND academic_year_id = v_year_id;
    END IF;

    -- Analytical Program (One sample per group for Español)
    SELECT id INTO v_subject_id FROM public.subject_catalog WHERE name = 'Español' AND educational_level = 'SECONDARY' LIMIT 1;

    FOREACH v_group_id IN ARRAY v_groups_ids LOOP
        -- Create Analytical Program if not exists
        SELECT id INTO v_program_id FROM public.analytical_programs WHERE group_id = v_group_id AND subject_id = v_subject_id LIMIT 1;
        
        IF v_program_id IS NULL THEN
            INSERT INTO public.analytical_programs (tenant_id, academic_year_id, group_id, subject_id, diagnosis_context, status)
            VALUES (v_tenant_id, v_year_id, v_group_id, v_subject_id, 'Diagnóstico generado automáticamente para el grupo.', 'DRAFT')
            RETURNING id INTO v_program_id;
        END IF;

        -- Create Students (Check if group has students)
        SELECT count(*) INTO i FROM public.students WHERE group_id = v_group_id;
        IF i < 25 THEN
             FOR j IN 1..(25-i) LOOP
                 INSERT INTO public.students (tenant_id, group_id, first_name, last_name_paternal, last_name_maternal, curp, gender, status)
                 VALUES (
                    v_tenant_id, 
                    v_group_id, 
                    a_first_names[floor(random() * array_length(a_first_names, 1) + 1)::int],
                    a_last_names[floor(random() * array_length(a_last_names, 1) + 1)::int],
                    a_last_names[floor(random() * array_length(a_last_names, 1) + 1)::int],
                    'CURPDUMMY' || floor(random()*1000000)::text,
                    CASE WHEN random() > 0.5 THEN 'M' ELSE 'F' END,
                    'ACTIVE'
                 ) RETURNING id INTO v_student_id;
                 v_students_ids := array_append(v_students_ids, v_student_id);
                 
                 -- Guardian (50% chance)
                 IF j % 2 = 0 THEN
                    INSERT INTO public.guardians (student_id, first_name, last_name_paternal, relationship, email, phone)
                    VALUES (v_student_id, 'Tutor', 'De ' || j, 'FATHER', 'tutor.gen' || floor(random()*10000)::text || '@demo.com', '5555555555');
                 END IF;
             END LOOP;
        END IF;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 6. ACADEMIC DATA (Assignments, Grades, Attendance)
    ---------------------------------------------------------------------------
    -- Create one assignment for the first group and grade it (if not exists)
    v_group_id := v_groups_ids[1];
    SELECT id INTO v_subject_id FROM public.subject_catalog WHERE name = 'Español' AND educational_level = 'SECONDARY' LIMIT 1;
    
    -- Check if assignment exists
    SELECT id INTO v_assignment_id FROM public.assignments WHERE group_id = v_group_id AND subject_id = v_subject_id AND title = 'Ensayo Literario' LIMIT 1;
    
    IF v_assignment_id IS NULL THEN
        INSERT INTO public.assignments (tenant_id, group_id, subject_id, title, description, type, due_date)
        VALUES (v_tenant_id, v_group_id, v_subject_id, 'Ensayo Literario', 'Escribir un ensayo sobre una obra clásica.', 'HOMEWORK', now() + interval '7 days')
        RETURNING id INTO v_assignment_id;
    END IF;
    
    -- Grade students in this group (only first 25 created)
    FOR v_student_id IN SELECT id FROM public.students WHERE group_id = v_group_id LOOP
        -- NOTE: Using ON CONFLICT requires a unique constraint. 
        -- We added it in schema step.
        INSERT INTO public.grades (tenant_id, assignment_id, student_id, score, is_graded, graded_at)
        VALUES (v_tenant_id, v_assignment_id, v_student_id, floor(random() * 5 + 5), true, now())
        ON CONFLICT (assignment_id, student_id) DO NOTHING;
        
        -- Attendance
        INSERT INTO public.attendance (tenant_id, group_id, student_id, date, status)
        VALUES (v_tenant_id, v_group_id, v_student_id, CURRENT_DATE, CASE WHEN random() > 0.1 THEN 'PRESENT' ELSE 'ABSENT' END)
        ON CONFLICT (student_id, date, group_id) DO NOTHING;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 7. TUTORS (Auth Users)
    ---------------------------------------------------------------------------
    FOR i IN 1..5 LOOP
        SELECT id INTO v_user_id FROM auth.users WHERE email = 'tutor' || i || '@demo.com';
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
            VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tutor' || i || '@demo.com', v_encrypted_pw, now(), '{"provider": "email", "providers": ["email"]}', jsonb_build_object('firstName', 'Tutor', 'lastNamePaternal', 'Demo ' || i, 'mode', 'INDEPENDENT'), now(), now());
        END IF;

        INSERT INTO public.profiles (id, tenant_id, first_name, last_name_paternal, role) VALUES (v_user_id, v_tenant_id, 'Tutor', 'Demo ' || i, 'TUTOR') ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.profile_roles (profile_id, role) VALUES (v_user_id, 'TUTOR') ON CONFLICT (profile_id, role) DO NOTHING;
        
        -- Link to a random student (Just pick one)
        SELECT id INTO v_student_id FROM public.students WHERE tenant_id = v_tenant_id ORDER BY random() LIMIT 1;
        
        -- Check if guardian link exists for this user
        PERFORM 1 FROM public.guardians WHERE user_id = v_user_id LIMIT 1;
        IF NOT FOUND THEN
             INSERT INTO public.guardians (student_id, user_id, first_name, last_name_paternal, relationship, email)
             VALUES (v_student_id, v_user_id, 'Tutor', 'Demo ' || i, 'MOTHER', 'tutor' || i || '@demo.com');
        END IF;
    END LOOP;

END $$;

COMMIT;
