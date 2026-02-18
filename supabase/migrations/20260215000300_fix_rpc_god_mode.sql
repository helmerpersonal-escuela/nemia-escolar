-- Migration: Force Restore God Mode RPC
-- Description: Ensures the function back_to_god_mode is always available in public schema.

CREATE OR REPLACE FUNCTION public.back_to_god_mode()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Security check: Only allow specific emails or users who are already marked as SUPER_ADMIN in the profiles table
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (
            email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com')
            OR role = 'SUPER_ADMIN'
        )
    ) THEN
        UPDATE public.profiles 
        SET tenant_id = NULL,
            role = 'SUPER_ADMIN'
        WHERE id = auth.uid();
    ELSE
        RAISE EXCEPTION 'Not authorized to access God Mode';
    END IF;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.back_to_god_mode() TO authenticated;
GRANT EXECUTE ON FUNCTION public.back_to_god_mode() TO service_role;
