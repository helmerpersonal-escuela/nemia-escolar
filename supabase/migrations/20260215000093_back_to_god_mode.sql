-- Migration: Restore God Mode Access
-- Description: Adds a function to reset the user's role to SUPER_ADMIN and clear the tenant context.

CREATE OR REPLACE FUNCTION public.back_to_god_mode()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Security check: Only allow specific emails or users who are already marked as SUPER_ADMIN in the profiles table
    -- (Even if their current role was temporarily changed by switch_workspace)
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
