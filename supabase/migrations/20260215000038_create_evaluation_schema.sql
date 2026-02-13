-- TABLA DE ASIGNACIONES (Tareas, Proyectos, Examenes)
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL, -- Puede ser null si es una actividad general
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    type TEXT NOT NULL CHECK (type IN ('HOMEWORK', 'EXAM', 'PROJECT', 'PARTICIPATION', 'CLASSWORK')),
    weightING_percentage NUMERIC(5,2) DEFAULT 0, -- Porcentaje del valor final (ej. 20%)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE CALIFICACIONES
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    score NUMERIC(5,2), -- Calificación (ej. 8.5, 100)
    feedback TEXT, -- Retroalimentación cualitativa
    is_graded BOOLEAN DEFAULT FALSE,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

-- TABLA DE ASISTENCIA
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, date, group_id) -- Un registro por alumno, por grupo, por día
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for now - authenticated users can access their tenant's data)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'assignments' AND policyname = 'Enable read over assignments for tenant'
    ) THEN
        CREATE POLICY "Enable read over assignments for tenant" ON public.assignments FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = assignments.tenant_id));
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'assignments' AND policyname = 'Enable insert for authenticated users only'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users only" ON public.assignments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'assignments' AND policyname = 'Enable update for owners'
    ) THEN
        CREATE POLICY "Enable update for owners" ON public.assignments FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'assignments' AND policyname = 'Enable delete for owners'
    ) THEN
        CREATE POLICY "Enable delete for owners" ON public.assignments FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'grades' AND policyname = 'Enable read over grades for tenant'
    ) THEN
        CREATE POLICY "Enable read over grades for tenant" ON public.grades FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = grades.tenant_id));
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'grades' AND policyname = 'Enable all for grades'
    ) THEN
        CREATE POLICY "Enable all for grades" ON public.grades FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'attendance' AND policyname = 'Enable read over attendance for tenant'
    ) THEN
        CREATE POLICY "Enable read over attendance for tenant" ON public.attendance FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = attendance.tenant_id));
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'attendance' AND policyname = 'Enable all for attendance'
    ) THEN
        CREATE POLICY "Enable all for attendance" ON public.attendance FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;
