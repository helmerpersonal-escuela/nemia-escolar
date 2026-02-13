-- Create group_subjects association table
CREATE TABLE IF NOT EXISTS public.group_subjects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    subject_catalog_id uuid REFERENCES public.subject_catalog(id) ON DELETE CASCADE,
    custom_name text, -- For custom subjects not in catalog
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT group_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT group_subjects_subject_check CHECK (
        (subject_catalog_id IS NOT NULL AND custom_name IS NULL) OR 
        (subject_catalog_id IS NULL AND custom_name IS NOT NULL)
    ),
    CONSTRAINT group_subjects_unique UNIQUE (group_id, subject_catalog_id, custom_name)
);

-- Enable RLS
ALTER TABLE public.group_subjects ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_subjects' AND policyname = 'Users can view group_subjects in own tenant'
    ) THEN
        CREATE POLICY "Users can view group_subjects in own tenant" ON public.group_subjects
            FOR SELECT USING (tenant_id = get_current_tenant_id());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_subjects' AND policyname = 'Admins/Teachers can manage group_subjects'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage group_subjects" ON public.group_subjects
            FOR ALL USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;
