-- Create chat_permissions table for granular access control
-- Allows DIRECTOR/ADMIN to assign custom chat visibility privileges

CREATE TABLE IF NOT EXISTS public.chat_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Permission flags
    can_view_all_users boolean DEFAULT false,
    can_view_staff boolean DEFAULT false,
    can_view_students boolean DEFAULT false,
    can_view_teachers boolean DEFAULT false,
    
    -- Metadata
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Ensure one permission record per user per tenant
    UNIQUE(tenant_id, profile_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_permissions_profile 
ON public.chat_permissions(profile_id);

CREATE INDEX IF NOT EXISTS idx_chat_permissions_tenant 
ON public.chat_permissions(tenant_id);

-- Enable RLS
ALTER TABLE public.chat_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own permissions
CREATE POLICY "Users can view own chat permissions" 
ON public.chat_permissions
FOR SELECT
USING (
    profile_id = auth.uid()
);

-- Policy: DIRECTOR/ADMIN can view all permissions in their tenant
CREATE POLICY "Directors/Admins can view all chat permissions" 
ON public.chat_permissions
FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN')
    )
);

-- Policy: DIRECTOR/ADMIN can manage (insert/update/delete) permissions
CREATE POLICY "Directors/Admins can manage chat permissions" 
ON public.chat_permissions
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('DIRECTOR', 'ADMIN')
    )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER chat_permissions_updated_at
BEFORE UPDATE ON public.chat_permissions
FOR EACH ROW
EXECUTE FUNCTION update_chat_permissions_updated_at();
