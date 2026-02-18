-- Migration: Student Citations for Prefectura
-- Citatorios (Citations) are documents issued to parents/tutors.

CREATE TABLE IF NOT EXISTS public.student_citations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    incident_id uuid REFERENCES public.student_incidents(id) ON DELETE SET NULL, -- Optional link to an incident
    reason text NOT NULL,
    meeting_date date NOT NULL,
    meeting_time time NOT NULL,
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'ATTENDED', 'CANCELLED')),
    requested_by uuid REFERENCES public.profiles(id), -- Prefect or Director who requested it
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_citations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view citations in their tenant"
ON public.student_citations
FOR SELECT
TO authenticated
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Staff can manage citations"
ON public.student_citations
FOR ALL
TO authenticated
USING (
    get_current_role() IN ('PREFECT', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD')
    AND tenant_id = get_current_tenant_id()
)
WITH CHECK (
    get_current_role() IN ('PREFECT', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD')
    AND tenant_id = get_current_tenant_id()
);
