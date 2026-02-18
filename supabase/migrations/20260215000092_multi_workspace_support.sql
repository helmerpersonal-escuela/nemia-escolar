-- Migration: Multi-Workspace Support
-- Description: Decouples profiles from a single tenant and allows users to have multiple workspaces.

-- 1. Create profile_tenants table
CREATE TABLE IF NOT EXISTS public.profile_tenants (
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    role text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (profile_id, tenant_id, role)
);

-- 2. Populate profile_tenants with current data
-- 2. Populate profile_tenants with current data
INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default)
SELECT id, tenant_id, role, true
FROM public.profiles
WHERE tenant_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Update profiles table to handle active workspace
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_tenant_id uuid REFERENCES public.tenants(id);

-- 4. RPC to switch active workspace
CREATE OR REPLACE FUNCTION public.switch_workspace(new_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    target_role text;
BEGIN
    -- Verify user belongs to this tenant and get their role there
    SELECT role INTO target_role 
    FROM profile_tenants 
    WHERE profile_id = auth.uid() AND tenant_id = new_tenant_id 
    LIMIT 1;

    IF target_role IS NOT NULL THEN
        UPDATE public.profiles 
        SET tenant_id = new_tenant_id,
            role = target_role
        WHERE id = auth.uid();
    ELSE
        RAISE EXCEPTION 'User does not belong to the specified workspace';
    END IF;
END;
$$;

-- 5. RPC to create a new workspace
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_type text, workspace_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_tenant_id uuid;
BEGIN
    -- 1. Create the tenant
    INSERT INTO public.tenants (name, type)
    VALUES (workspace_name, workspace_type)
    RETURNING id INTO new_tenant_id;

    -- 2. Link the creator to the tenant
    INSERT INTO public.profile_tenants (profile_id, tenant_id, role, is_default)
    VALUES (auth.uid(), new_tenant_id, workspace_role, false);

    -- 3. Set as active workspace
    UPDATE public.profiles SET tenant_id = new_tenant_id WHERE id = auth.uid();

    RETURN new_tenant_id;
END;
$$;

-- 6. "Rescue" logic for the user
-- Revert the type of the current tenant to INDEPENDENT if it was overwritten
-- This is a one-time fix for existing users who accidentally overwritten their teacher workspace
UPDATE public.tenants
SET type = 'INDEPENDENT'
WHERE id IN (
    SELECT tenant_id 
    FROM public.profiles 
    WHERE id = auth.uid()
) AND type = 'SCHOOL';

-- 7. Update RLS for tenants (to allow viewing all workspaces one belongs to)
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Users can view their workspaces" ON public.tenants;

CREATE POLICY "Users can view their workspaces" ON public.tenants
FOR SELECT USING (
    id IN (SELECT tenant_id FROM public.profile_tenants WHERE profile_id = auth.uid())
);
