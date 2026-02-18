-- Create or Update school_details table
-- This table stores specific configuration for school tenants

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

-- Enable RLS
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;

-- Policies for school_details
-- 1. View: Authenticated users can view details of their tenant
CREATE POLICY "Users can view school details of their tenant" 
ON public.school_details 
FOR SELECT 
TO authenticated 
USING (tenant_id IN (
    SELECT tenant_id FROM public.profile_tenants WHERE profile_id = auth.uid()
));

-- 2. Update: Only admins/directors can update
CREATE POLICY "Admins can update school details" 
ON public.school_details 
FOR UPDATE 
TO authenticated 
USING (tenant_id IN (
    SELECT tenant_id FROM public.profile_tenants 
    WHERE profile_id = auth.uid() 
    AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')
));

-- 3. Insert: Only admins/directors can insert (usually done at creation)
CREATE POLICY "Admins can insert school details" 
ON public.school_details 
FOR INSERT 
TO authenticated 
WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.profile_tenants 
    WHERE profile_id = auth.uid() 
    AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')
));

-- Ensure columns exist if table already existed (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_details' AND column_name = 'workshops') THEN
        ALTER TABLE public.school_details ADD COLUMN workshops jsonb DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_details' AND column_name = 'cte_config') THEN
        ALTER TABLE public.school_details ADD COLUMN cte_config jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;
