-- 20260218120000_student_alerts.sql
-- Table for granular student-related alerts for Tutors

CREATE TABLE IF NOT EXISTS public.student_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    tutor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSIGNMENT_CREATED', 'COMPLIANCE_REPORT', 'GRADE_POSTED', 'ATTENDANCE_ALERT')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.student_alerts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tutors can view their own student alerts" ON public.student_alerts
FOR SELECT USING (
    auth.uid() = tutor_id
);

-- Indexing for performance
CREATE INDEX idx_student_alerts_tutor_id ON public.student_alerts(tutor_id);
CREATE INDEX idx_student_alerts_student_id ON public.student_alerts(student_id);
CREATE INDEX idx_student_alerts_read_at ON public.student_alerts(read_at);
