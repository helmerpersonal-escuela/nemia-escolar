-- 20260218130000_enhance_events.sql
-- Enhance teacher_events with notification capabilities

ALTER TABLE public.teacher_events 
ADD COLUMN IF NOT EXISTS notify_tutors BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- If a teacher event is created/updated with notify_tutors = true, we could use a trigger, 
-- but we will handle it in the frontend for more control over the message content.
