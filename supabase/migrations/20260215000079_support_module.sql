-- 20260215000077_support_module.sql

-- 1. Student Tracking Table (Bitácora de Seguimiento)
CREATE TABLE IF NOT EXISTS public.student_tracking (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- Staff Member
    type text NOT NULL CHECK (type IN ('ENTREVISTA', 'CANALIZACION', 'SEGUIMIENTO', 'BITACORA', 'VISITA_DOMICILIARIA')),
    status text NOT NULL DEFAULT 'ABIERTO' CHECK (status IN ('ABIERTO', 'EN_PROCESO', 'CERRADO', 'CANALIZADO')),
    severity text DEFAULT 'MEDIA' CHECK (severity IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
    title text NOT NULL,
    description text,
    agreements text, -- Acuerdos
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Behavioral Contracts / Specific Formats (Formatos y Actas)
CREATE TABLE IF NOT EXISTS public.behavioral_contracts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    type text NOT NULL CHECK (type IN ('COMPROMISO_CONDUCTA', 'INASISTENCIAS', 'RETARDOS', 'INCIDENCIAS_LEVES', 'OTRO')),
    content jsonb DEFAULT '{}'::jsonb, -- Stores form specific fields (antecedentes, consecuencias, etc.)
    signed boolean DEFAULT false,
    valid_until date,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Dropout Risk Cases (Riesgo de Deserción)
CREATE TABLE IF NOT EXISTS public.dropout_risk_cases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    detected_at timestamp with time zone DEFAULT now(),
    risk_factors jsonb, -- ['FALTAS', 'REPROBACION', 'CONDUCTA', 'ECONOMICOS']
    intervention_plan text,
    status text DEFAULT 'DETECTADO' CHECK (status IN ('DETECTADO', 'INTERVENCION', 'MONITOREO', 'RESUELTO', 'BAJA_DEFINITIVA')),
    last_update timestamp with time zone DEFAULT now(),
    UNIQUE(student_id) -- Only one active case per student essentially, or we can allow history
);

-- RLS Policies

-- Enable RLS
ALTER TABLE public.student_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropout_risk_cases ENABLE ROW LEVEL SECURITY;

-- Policies for Support Staff (SUPPORT role) and Management (DIRECTOR, ADMIN)
-- They should have full access.
-- Teachers might have READ access to some parts, but let's restrict to SUPPORT/ADMIN for now for confidentiality.

CREATE POLICY "Support and Admin manage tracking" ON public.student_tracking
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.student_tracking.tenant_id
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'PREFECT')
    )
);

CREATE POLICY "Support and Admin manage contracts" ON public.behavioral_contracts
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.behavioral_contracts.tenant_id
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'PREFECT')
    )
);

CREATE POLICY "Support and Admin manage dropout cases" ON public.dropout_risk_cases
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = public.dropout_risk_cases.tenant_id
        AND profiles.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'PREFECT')
    )
);
