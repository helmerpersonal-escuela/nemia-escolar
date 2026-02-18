-- Create schedules table
CREATE TABLE IF NOT EXISTS public.schedules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subject_catalog(id),
    custom_subject text,
    day_of_week text NOT NULL CHECK (day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT schedules_pkey PRIMARY KEY (id),
    CONSTRAINT schedules_subject_check CHECK (
        (subject_id IS NOT NULL AND custom_subject IS NULL) OR 
        (subject_id IS NULL AND custom_subject IS NOT NULL)
    )
);

-- Enable RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view schedules in own tenant" ON public.schedules;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedules' AND policyname = 'Users can view schedules in own tenant'
    ) THEN
        CREATE POLICY "Users can view schedules in own tenant" ON public.schedules
    FOR SELECT USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;

DROP POLICY IF EXISTS "Admins/Teachers can manage schedules" ON public.schedules;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedules' AND policyname = 'Admins/Teachers can manage schedules'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage schedules" ON public.schedules
    FOR ALL USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;
