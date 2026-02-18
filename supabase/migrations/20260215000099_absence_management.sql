-- 20260215000100_absence_management.sql

-- Table to store absence plans and their associated activities
CREATE TABLE IF NOT EXISTS public.absence_plans (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    activities JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of activities per class/session
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT absence_plans_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.absence_plans ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage their own absence plans" ON public.absence_plans;
CREATE POLICY "Users can manage their own absence plans"
ON public.absence_plans
FOR ALL
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all absence plans in tenant" ON public.absence_plans;
CREATE POLICY "Admins can view all absence plans in tenant"
ON public.absence_plans
FOR SELECT
USING (tenant_id = get_current_tenant_id());

-- Helper function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_absence_plans_updated_at ON public.absence_plans;
CREATE TRIGGER update_absence_plans_updated_at
    BEFORE UPDATE ON public.absence_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
