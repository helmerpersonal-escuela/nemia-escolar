-- 20260215000065_assignments_and_calendar_sync.sql

-- 1. Add is_direction to calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS is_direction boolean DEFAULT false;

-- 2. Add advisory_group_id to profiles for teacher assignments
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS advisory_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- 3. Update RLS for calendar_events to allow all users to see direction events
DROP POLICY IF EXISTS "Enable read access for all users" ON public.calendar_events;
CREATE POLICY "Enable read access for all users" ON public.calendar_events 
FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR is_official_sep = true
);

-- 4. Specific policy for Direction Events (redundant but explicit)
DROP POLICY IF EXISTS "Users can see direction events" ON public.calendar_events;
CREATE POLICY "Users can see direction events" ON public.calendar_events
FOR SELECT USING (
    is_direction = true 
    AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- 5. Policies for managing assignments (Admins only)
-- group_subjects and schedules are already covered by tenant_id policies, 
-- but let's ensure admins can manage calendar_events with is_direction=true
DROP POLICY IF EXISTS "Admins can manage direction events" ON public.calendar_events;
CREATE POLICY "Admins can manage direction events" ON public.calendar_events
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')
    )
);
