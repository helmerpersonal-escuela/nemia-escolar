-- Create class_plans table
CREATE TABLE public.class_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.group_subjects(id) ON DELETE SET NULL,
    lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE SET NULL,
    class_date DATE NOT NULL,
    duration_or_module TEXT,
    ai_generated_content JSONB NOT NULL DEFAULT '{}'::jsonb,
    teacher_reflection TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger
CREATE TRIGGER update_class_plans_updated_at
    BEFORE UPDATE ON public.class_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.class_plans ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view class plans of their tenant"
    ON public.class_plans FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert class plans in their tenant"
    ON public.class_plans FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update class plans in their tenant"
    ON public.class_plans FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete class plans in their tenant"
    ON public.class_plans FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Indexing for performance
CREATE INDEX idx_class_plans_tenant_id ON public.class_plans(tenant_id);
CREATE INDEX idx_class_plans_group_id ON public.class_plans(group_id);
CREATE INDEX idx_class_plans_date ON public.class_plans(class_date);
