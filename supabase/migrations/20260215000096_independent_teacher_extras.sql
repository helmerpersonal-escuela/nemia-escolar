-- 20260215000092_independent_teacher_extras.sql

-- 1. Allow INDEPENDENT_TEACHER to manage school_details
DO $$
BEGIN
    -- Drop existing policy if it's too restrictive (Admins can manage school details)
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'school_details' AND policyname = 'Admins can manage school details'
    ) THEN
        DROP POLICY "Admins can manage school details" ON public.school_details;
    END IF;

    -- Re-create policy including INDEPENDENT_TEACHER
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'school_details' AND policyname = 'Admins and Independent Teachers can manage school details'
    ) THEN
        CREATE POLICY "Admins and Independent Teachers can manage school details"
        ON public.school_details FOR ALL
        USING (EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'INDEPENDENT_TEACHER')
        ));
    END IF;
END $$;

-- 2. Ensure school_details row exists for every Independent Teacher tenant
-- This is a self-healing step. If an independent teacher was created but no school_details row exists,
-- they won't be able to "UPDATE" it. We should ensure they can INSERT or we auto-create.
-- The policy above allows ALL (Insert/Update/Delete), so they can insert if needed.
-- But let's add a trigger or just a one-time fix for existing ones.

INSERT INTO public.school_details (tenant_id, official_name, cct, educational_level)
SELECT id, name, 'PARTICULAR', 'PRIMARY'
FROM public.tenants
WHERE type = 'INDEPENDENT'
AND id NOT IN (SELECT tenant_id FROM public.school_details)
ON CONFLICT (tenant_id) DO NOTHING;
