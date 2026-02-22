-- Migration: Admin Password Reset RPC
-- Description: Allows Super Admins to set a provisional password for any user.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_set_any_password(target_user_id UUID, new_password TEXT)
RETURNS JSONB AS $$
DECLARE
    is_admin boolean;
BEGIN
    -- 1. Check if the caller is a Super Admin
    SELECT public.is_god_mode() INTO is_admin;
    
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admins can reset passwords.';
    END IF;

    -- 2. Update the password in auth.users
    -- We explicitly use the extensions schema for crypt and gen_salt
    UPDATE auth.users
    SET 
        encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()), 
        updated_at = NOW()
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

-- Grant access to authenticated users (they will be blocked by internal check anyway)
GRANT EXECUTE ON FUNCTION public.admin_set_any_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_any_password(UUID, TEXT) TO service_role;
