-- This script fixes the "Bad Request" error by ensuring the necessary columns exist.
-- Run this in the Supabase SQL Editor.

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

ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS workshops jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS cte_config jsonb DEFAULT '{}'::jsonb;

-- Ensure RLS is enabled
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;

-- Simple policy to allow reading
CREATE POLICY "Allow read access"
ON public.school_details
FOR SELECT
TO authenticated
USING (true);

-- Simple policy to allow modifications
CREATE POLICY "Allow all access for tenant members"
ON public.school_details
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
