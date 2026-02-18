-- 1. Add 'is_closed' column to evaluation_periods
ALTER TABLE public.evaluation_periods 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;

-- 2. Create 'evaluation_snapshots' table for historical records
CREATE TABLE IF NOT EXISTS public.evaluation_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    
    -- Optional references depending on the type of snapshot
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL, 
    period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE SET NULL, -- Null if ACADEMIC_YEAR
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL, -- Useful for yearly snapshots

    type TEXT NOT NULL CHECK (type IN ('TRIMESTER', 'ACADEMIC_YEAR')),
    
    final_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    
    -- JSONB for flexible storage of stats and breakdown
    -- stats example: { "attendance": 45, "absences": 2, "delays": 1 }
    stats JSONB DEFAULT '{}'::jsonb,
    
    -- breakdown example: { "criteria": { "exam": 30, "homework": 20 }, "activities": [...] }
    breakdown JSONB DEFAULT '{}'::jsonb,
    
    status TEXT DEFAULT 'FINAL' CHECK (status IN ('FINAL', 'DRAFT', 'AMENDED')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.evaluation_snapshots ENABLE ROW LEVEL SECURITY;

-- 4. Policies for evaluation_snapshots
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_snapshots' AND policyname = 'Tenant users can view snapshots'
    ) THEN
        CREATE POLICY "Tenant users can view snapshots" ON public.evaluation_snapshots
    FOR SELECT
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_snapshots.tenant_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'evaluation_snapshots' AND policyname = 'Tenant admins/teachers can manage snapshots'
    ) THEN
        CREATE POLICY "Tenant admins/teachers can manage snapshots" ON public.evaluation_snapshots
    FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = evaluation_snapshots.tenant_id));
    END IF;
END $$;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_snapshots_student ON public.evaluation_snapshots(student_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_group_period ON public.evaluation_snapshots(group_id, period_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant ON public.evaluation_snapshots(tenant_id);
