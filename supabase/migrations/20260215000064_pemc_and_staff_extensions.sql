-- 20260215000063_pemc_and_staff_extensions.sql

-- 1. PEMC Tables
CREATE TABLE IF NOT EXISTS public.pemc_cycles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL, -- Ej: "Programa Plurianual 2024-2026"
    start_year integer NOT NULL,
    end_year integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.pemc_diagnosis (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id uuid REFERENCES public.pemc_cycles(id) ON DELETE CASCADE,
    field_name text NOT NULL, -- Ej: "Aprovechamiento académico", "Infraestructura"
    content text, -- "Lectura de la realidad"
    evidence_urls jsonb DEFAULT '[]'::jsonb, -- Array de URLs de archivos
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pemc_objectives (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id uuid REFERENCES public.pemc_cycles(id) ON DELETE CASCADE,
    description text NOT NULL,
    goal text, -- Meta medible
    is_completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pemc_actions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    objective_id uuid REFERENCES public.pemc_objectives(id) ON DELETE CASCADE,
    description text NOT NULL,
    responsible_profile_id uuid REFERENCES public.profiles(id),
    deadline date,
    resources text,
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pemc_monitoring (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action_id uuid REFERENCES public.pemc_actions(id) ON DELETE CASCADE,
    progress_percentage integer DEFAULT 0,
    comment text,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Staff Extensions
CREATE TABLE IF NOT EXISTS public.staff_commissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL, -- Ej: "Comisión de Guardia", "Tutoría 3ºA"
    description text,
    academic_year_id uuid REFERENCES public.academic_years(id),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    date date DEFAULT CURRENT_DATE,
    status text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'PERMIT')),
    check_in timestamp with time zone,
    check_out timestamp with time zone,
    notes text,
    UNIQUE(profile_id, date)
);

CREATE TABLE IF NOT EXISTS public.staff_permits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    evidence_url text, -- Link a justificante médico, etc.
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.pemc_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemc_diagnosis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemc_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemc_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemc_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permits ENABLE ROW LEVEL SECURITY;

-- 4. Policies (DIRECTOR/ADMIN access)
DO $$ 
BEGIN
    -- Pemc Cycles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage pemc cycles') THEN
        CREATE POLICY "Admins manage pemc cycles" ON public.pemc_cycles
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN') AND tenant_id = pemc_cycles.tenant_id));
    END IF;

    -- Staff Commissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage staff commissions') THEN
        CREATE POLICY "Admins manage staff commissions" ON public.staff_commissions
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN') AND tenant_id = staff_commissions.tenant_id));
    END IF;

    -- Staff Attendance (Admins manage, Users read own)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage staff attendance') THEN
        CREATE POLICY "Admins manage staff attendance" ON public.staff_attendance
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN') AND tenant_id = staff_attendance.tenant_id));
    END IF;
END $$;
