-- Migration: Teacher Module Attendance for Secondary School
-- Each module is 50 minutes, tracking per class.

CREATE TABLE IF NOT EXISTS public.teacher_module_attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL, -- Link to the specific schedule entry
    date date DEFAULT CURRENT_DATE NOT NULL,
    status text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
    check_in timestamp with time zone DEFAULT now(),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(teacher_id, schedule_id, date)
);

-- Enable RLS
ALTER TABLE public.teacher_module_attendance ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Teachers can view and insert their own attendance
CREATE POLICY "Teachers can manage own module attendance"
ON public.teacher_module_attendance
FOR ALL
TO authenticated
USING (
    teacher_id = auth.uid() AND 
    tenant_id = get_current_tenant_id()
)
WITH CHECK (
    teacher_id = auth.uid() AND 
    tenant_id = get_current_tenant_id()
);

-- 2. Admins and Prefects can view all module attendance
CREATE POLICY "Admins and Prefects view all module attendance"
ON public.teacher_module_attendance
FOR SELECT
TO authenticated
USING (
    tenant_id = get_current_tenant_id() AND
    get_current_role() IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT')
);

-- 3. Prefects can update attendance (e.g., to correct a status)
CREATE POLICY "Prefects can manage module attendance"
ON public.teacher_module_attendance
FOR UPDATE
TO authenticated
USING (
    tenant_id = get_current_tenant_id() AND
    get_current_role() IN ('PREFECT', 'ADMIN', 'DIRECTOR')
);
