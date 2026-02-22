-- Create teacher_events table if not exists
CREATE TABLE IF NOT EXISTS public.teacher_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    type TEXT DEFAULT 'PERSONAL',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teacher_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teachers can view their own events"
    ON public.teacher_events
    FOR SELECT
    USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can insert their own events"
    ON public.teacher_events
    FOR INSERT
    WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own events"
    ON public.teacher_events
    FOR UPDATE
    USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their own events"
    ON public.teacher_events
    FOR DELETE
    USING (auth.uid() = teacher_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teacher_events_teacher_id ON public.teacher_events(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_events_tenant_id ON public.teacher_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_events_start_time ON public.teacher_events(start_time);
