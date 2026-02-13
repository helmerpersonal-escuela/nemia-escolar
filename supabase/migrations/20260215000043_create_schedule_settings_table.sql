-- Create schedule_settings table
CREATE TABLE IF NOT EXISTS public.schedule_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    start_time time NOT NULL DEFAULT '07:00:00',
    end_time time NOT NULL DEFAULT '14:00:00',
    module_duration integer NOT NULL DEFAULT 50, -- in minutes
    breaks jsonb DEFAULT '[]'::jsonb, -- Array of {name, start_time, end_time}
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT schedule_settings_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_settings_tenant_key UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view settings in own tenant" ON public.schedule_settings;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedule_settings' AND policyname = 'Users can view settings in own tenant'
    ) THEN
        CREATE POLICY "Users can view settings in own tenant" ON public.schedule_settings
    FOR SELECT USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;

DROP POLICY IF EXISTS "Admins can manage settings" ON public.schedule_settings;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedule_settings' AND policyname = 'Admins can manage settings'
    ) THEN
        CREATE POLICY "Admins can manage settings" ON public.schedule_settings
    FOR ALL USING (tenant_id = get_current_tenant_id());
    END IF;
END $$;
