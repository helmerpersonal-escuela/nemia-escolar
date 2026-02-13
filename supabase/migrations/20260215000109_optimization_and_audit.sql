-- ==========================================
-- OPTIMIZATION & AUDIT SYSTEM MIGRATION
-- ==========================================

BEGIN;

-- 1. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data jsonb,
    new_data jsonb,
    changed_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Audit Trigger Function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), auth.uid());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Audit to Key Tables (Examples)
-- Note: Add more tables as needed.
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name IN ('tenants', 'profiles', 'groups', 'students', 'lesson_plans')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_audit_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER tr_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()', t, t);
    END LOOP;
END $$;

-- 4. Performance: Missing Indices for Tenant Isolation
-- We ensure every table with tenant_id is indexed for fast lookups.
DO $$
DECLARE
    t text;
    c text;
BEGIN
    FOR t, c IN SELECT table_name, column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND column_name = 'tenant_id'
    LOOP
        -- Check if index already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid = i.indrelid
            JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
            WHERE c.relname = t AND a.attname = 'tenant_id'
        ) THEN
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON public.%I(tenant_id)', t, t);
        END IF;
    END LOOP;
END $$;

-- 5. Hardening: Global profiles shouldn't have sensitive data
-- (Already covered by RLS, but double checking indices on foreign keys)
CREATE INDEX IF NOT EXISTS idx_profile_roles_profile_id ON public.profile_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_tenants_profile_id ON public.profile_tenants(profile_id);

COMMIT;
