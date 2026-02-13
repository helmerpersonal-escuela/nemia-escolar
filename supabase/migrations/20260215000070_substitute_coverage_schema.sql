-- Create table for teacher absences
CREATE TABLE IF NOT EXISTS public.teacher_absences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- The absent teacher
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'RESOLVED')), -- RESOLVED when coverage is done
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for activities left for substitutes (Prefects/Guardias)
CREATE TABLE IF NOT EXISTS public.substitution_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    absence_id UUID REFERENCES public.teacher_absences(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subject_catalog(id) ON DELETE SET NULL,
    module_index INTEGER, -- Which hour/module of the day
    activity_title TEXT NOT NULL,
    activity_description TEXT NOT NULL,
    ai_generated_hints TEXT, -- AI suggestions/hints
    resources_urls JSONB DEFAULT '[]'::jsonb,
    is_completed BOOLEAN DEFAULT FALSE,
    prefect_observations TEXT, -- Observations by the prefect who attended
    attended_by UUID REFERENCES public.profiles(id), -- The prefect who covered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.teacher_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitution_activities ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own absences" ON public.teacher_absences
FOR ALL USING (auth.uid() = profile_id);

CREATE POLICY "Admins and Prefects can view all absences" ON public.teacher_absences
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT') 
        AND tenant_id = teacher_absences.tenant_id
    )
);

CREATE POLICY "Staff can view substitution activities for their tenant" ON public.substitution_activities
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND tenant_id = substitution_activities.tenant_id
    )
);

CREATE POLICY "Prefects and Admins can update activities" ON public.substitution_activities
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'PREFECT') 
        AND tenant_id = substitution_activities.tenant_id
    )
);

CREATE POLICY "Teachers can insert/manage their activities" ON public.substitution_activities
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.teacher_absences
        WHERE id = substitution_activities.absence_id
        AND profile_id = auth.uid()
    )
);
