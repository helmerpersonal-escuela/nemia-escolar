-- 1. Create profile_roles table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.profile_roles (
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (profile_id, role)
);

-- 2. Add constraint to ensure role is valid
DO $$ 
BEGIN 
    ALTER TABLE public.profile_roles ADD CONSTRAINT profile_roles_check 
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
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Enable RLS
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profile_roles' AND policyname = 'Users can view their own roles'
    ) THEN
        CREATE POLICY "Users can view their own roles"
        ON public.profile_roles FOR SELECT
        USING (profile_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profile_roles' AND policyname = 'Admins can manage roles in their tenant'
    ) THEN
        CREATE POLICY "Admins can manage roles in their tenant"
        ON public.profile_roles FOR ALL
        USING (EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
        ));
    END IF;
END $$;

-- 4. Initial migration: Link current roles
INSERT INTO public.profile_roles (profile_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (profile_id, role) DO NOTHING;

-- 5. RPC to change current active role
CREATE OR REPLACE FUNCTION public.switch_active_role(new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Verify user has this role
    IF EXISTS (SELECT 1 FROM profile_roles WHERE profile_id = auth.uid() AND role = new_role) THEN
        UPDATE public.profiles SET role = new_role WHERE id = auth.uid();
    ELSE
        RAISE EXCEPTION 'User does not have the specified role';
    END IF;
END;
$$;
