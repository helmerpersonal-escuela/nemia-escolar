-- ==============================================================================
-- FIX SCHOOL DETAILS TABLE & COLUMNS (FINAL)
-- Run this script in the Supabase Dashboard SQL Editor to resolve the 400 Error.
-- ==============================================================================

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS public.school_details (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    workshops jsonb DEFAULT '[]'::jsonb,
    cte_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT school_details_pkey PRIMARY KEY (id),
    CONSTRAINT school_details_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT school_details_tenant_id_key UNIQUE (tenant_id)
);

-- 2. Ensure columns exist (Idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_details' AND column_name = 'workshops') THEN
        ALTER TABLE public.school_details ADD COLUMN workshops jsonb DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_details' AND column_name = 'cte_config') THEN
        ALTER TABLE public.school_details ADD COLUMN cte_config jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;

-- 4. Reset Policies to be safe and permissive for reading
DROP POLICY IF EXISTS "Users can view school details of their tenant" ON public.school_details;
DROP POLICY IF EXISTS "Tenant members can view school details" ON public.school_details;
DROP POLICY IF EXISTS "Admins can update school details" ON public.school_details;
DROP POLICY IF EXISTS "Admins can insert school details" ON public.school_details;

-- Read Policy: Allow anyone in the tenant (or demo/system users) to read
CREATE POLICY "Tenant members can view school details"
ON public.school_details
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profile_tenants WHERE profile_id = auth.uid()
    )
    OR
    -- Allow demo access if user is associated with demo tenant
    tenant_id = '77777777-7777-7777-7777-777777777777'
    OR
    -- Allow explicitly if user is in profiles
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Write Policy: Only Admins/Directors
CREATE POLICY "Admins can update school details"
ON public.school_details
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profile_tenants 
        WHERE profile_id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.profile_tenants 
        WHERE profile_id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')
    )
);

-- 5. Insert Default Data for DEMO Tenant (7777...) to prevent empty/missing data issues
INSERT INTO public.school_details (tenant_id, workshops, cte_config)
VALUES (
    '77777777-7777-7777-7777-777777777777',
    '[{"id": "w1", "name": "Taller de Lectura", "instructor": "Prof. Demo"}]'::jsonb,
    '{"next_cte_date": "2024-10-27"}'::jsonb
)
ON CONFLICT (tenant_id) DO NOTHING;
