-- Migration: Admin Verify Email RPC
-- Description: Allows Super Admins to manually verify any user's email.

CREATE OR REPLACE FUNCTION public.admin_verify_email(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    is_admin boolean;
BEGIN
    -- 1. Check if the caller is a Super Admin
    SELECT public.is_god_mode() INTO is_admin;
    
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admins can verify emails.';
    END IF;

    -- 2. Update the email confirmation in auth.users
    UPDATE auth.users
    SET 
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Email verified successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Grant access to authenticated users (they will be blocked by internal check anyway)
GRANT EXECUTE ON FUNCTION public.admin_verify_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_email(UUID) TO service_role;
