-- Migration: Mandatory Settings & Academic Year Enforcements

-- 1. Create schedule_settings table (if not exists)
CREATE TABLE IF NOT EXISTS public.schedule_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    start_time TIME NOT NULL DEFAULT '07:00',
    end_time TIME NOT NULL DEFAULT '14:00',
    module_duration INTEGER NOT NULL DEFAULT 50, -- in minutes
    breaks JSONB DEFAULT '[]'::jsonb, -- Array of {name, start_time, end_time}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for schedule_settings
ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedule_settings' AND policyname = 'Users can view schedule settings in their own tenant'
    ) THEN
        CREATE POLICY "Users can view schedule settings in their own tenant"
        ON public.schedule_settings FOR SELECT
        USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schedule_settings' AND policyname = 'Admins/Teachers can manage schedule settings'
    ) THEN
        CREATE POLICY "Admins/Teachers can manage schedule settings"
        ON public.schedule_settings FOR ALL
        USING (EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND tenant_id = schedule_settings.tenant_id 
            AND role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'INDEPENDENT_TEACHER')
        ));
    END IF;
END $$;


-- 2. Ensure academic_years exists and has is_active logic
-- (Table creation is in 20260215000055_setup_phase2.sql, here we just ensure content/indexes)

-- Index for fast lookup of active year
CREATE INDEX IF NOT EXISTS idx_academic_years_active ON public.academic_years(tenant_id, is_active);

-- Helper function to ensure only ONE active year per tenant
CREATE OR REPLACE FUNCTION public.handle_single_active_academic_year()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE public.academic_years
        SET is_active = false
        WHERE tenant_id = NEW.tenant_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_academic_year_active_update ON public.academic_years;
CREATE TRIGGER on_academic_year_active_update
    BEFORE INSERT OR UPDATE OF is_active ON public.academic_years
    FOR EACH ROW
    WHEN (NEW.is_active = true)
    EXECUTE FUNCTION public.handle_single_active_academic_year();
