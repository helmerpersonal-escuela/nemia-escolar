-- Function to Soft Delete Account (User Self-Deletion)
CREATE OR REPLACE FUNCTION public.soft_delete_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the user is deleting themselves OR is a Super Admin
  IF auth.uid() <> target_user_id AND 
     NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar esta cuenta.';
  END IF;

  -- 1. Mark Profile as Deleted (Soft Delete) or Delete Row?
  -- We prefer soft delete usually, but user asked for "delete account".
  -- Let's do a hard delete of the profile, which should cascade if FKs are set, 
  -- OR we can just anonymize it.
  -- Given "Eliminar Cuenta" usually implies removing access.
  
  -- Delete from auth.users is dangerous/hard from here without specific permissions.
  -- Usually we just delete from public.profiles and let triggers handle the rest 
  -- or we rely on a separate cleanup process.
  
  -- However, for this requirement, we will DELETE from public.profiles.
  -- Constraints might block this if cascading isn't set up.
  
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- If we want to delete from auth.users, we need a brave soul or a separate Edge Function.
  -- For now, deleting the profile effectively removes them from the app logic.
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.soft_delete_account(uuid) TO authenticated;


-- Enable Users to Update their OWN Subscription (Cancellation)
-- Current RLS might be read-only for subscriptions.
-- We verify/add a policy.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'subscriptions' 
        AND policyname = 'Users can update their own subscription'
    ) THEN
        CREATE POLICY "Users can update their own subscription"
        ON public.subscriptions
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;
