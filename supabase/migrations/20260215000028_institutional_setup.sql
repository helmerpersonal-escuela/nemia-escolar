-- 1. Update Roles Constraint in profiles table
-- We need to drop the old constraint and add the new one
DO $$ 
BEGIN 
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN (
        'SUPER_ADMIN',
        'ADMIN',
        'DIRECTOR',
        'ACADEMIC_COORD',
        'TECH_COORD',
        'SCHOOL_CONTROL',
        'TEACHER',
        'PREFECT',
        'SUPPORT',
        'TUTOR',
        'STUDENT'
    ));
END $$;

-- 2. Create school_details table
CREATE TABLE IF NOT EXISTS public.school_details (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Identity
    official_name text NOT NULL,
    cct text NOT NULL,
    shift text CHECK (shift IN ('MORNING', 'AFTERNOON', 'FULL_TIME')),
    zone text,
    sector text,
    regime text, -- Public (Federal, State, Transferred)
    
    -- Location
    address_street text,
    address_neighborhood text,
    address_zip_code text,
    address_municipality text,
    address_state text,
    
    -- Contact
    phone text,
    email text,
    social_media jsonb DEFAULT '{}'::jsonb,
    
    -- Academic
    educational_level text, -- General, Technical, Telesecundaria
    curriculum_plan text, -- Plan 2022, etc.
    workshops text[], -- List of technologies/emphasis
    
    -- Representation
    director_name text,
    director_curp text,
    
    -- Assets
    logo_url text,
    header_logo_url text, -- SEP / Official Government logos
    digital_seal_url text,
    
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Enable RLS for school_details
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'school_details' AND policyname = 'Users can view school details in their own tenant'
    ) THEN
        CREATE POLICY "Users can view school details in their own tenant"
        ON public.school_details FOR SELECT
        USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'school_details' AND policyname = 'Admins can manage school details'
    ) THEN
        CREATE POLICY "Admins can manage school details"
        ON public.school_details FOR ALL
        USING (EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
        ));
    END IF;
END $$;

-- 4. Sync existing logos from tenants to school_details (Mental Migration)
-- This ensures that any logo already uploaded is available in the new structure
INSERT INTO public.school_details (tenant_id, official_name, cct, logo_url)
SELECT id, name, COALESCE(cct, 'SIN-CCT'), logo_url
FROM public.tenants
ON CONFLICT (tenant_id) DO UPDATE SET
    official_name = EXCLUDED.official_name,
    cct = EXCLUDED.cct,
    logo_url = EXCLUDED.logo_url;
