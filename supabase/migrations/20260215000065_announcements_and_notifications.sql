-- 20260215000064_announcements_and_notifications.sql

-- 1. School Announcements Table
CREATE TABLE IF NOT EXISTS public.school_announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id),
    title text NOT NULL,
    content text NOT NULL,
    target_roles text[] DEFAULT '{}', -- Array de roles (ej: {'TEACHER', 'STUDENT'})
    target_groups uuid[] DEFAULT '{}', -- Array de IDs de grupos
    send_email boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Announcement Receipts (to track reading)
CREATE TABLE IF NOT EXISTS public.announcement_receipts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id uuid REFERENCES public.school_announcements(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at timestamp with time zone,
    UNIQUE(announcement_id, profile_id)
);

-- 3. Enable RLS
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_receipts ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DO $$ 
BEGIN
    -- Announcements
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage announcements') THEN
        CREATE POLICY "Admins manage announcements" ON public.school_announcements
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN') AND tenant_id = school_announcements.tenant_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view relevant announcements') THEN
        CREATE POLICY "Users view relevant announcements" ON public.school_announcements
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND (
                    p.role = ANY(target_roles) 
                    OR target_roles = '{}' 
                    OR p.role IN ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN')
                )
            )
        );
    END IF;
END $$;
