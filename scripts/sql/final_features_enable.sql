-- 1. Enable Users to Update their OWN Subscription (Cancellation)
-- This allows the "Cancel Subscription" button to work.
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

-- 2. Ensure Soft Delete Function Exists (Robust Version)
-- This allows the "Delete Account" button to work safely.
create or replace function public.soft_delete_account(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    current_email text;
    new_email text;
begin
    -- 1. Get current email
    select email into current_email from auth.users where id = target_user_id;

    -- 2. Create a "tombstone" email to release the original one
    -- Avoids unique constraint violation if they try to register again immediately
    new_email := current_email || '.deleted.' || floor(extract(epoch from now())) || '@internal.edu';

    -- 3. Update auth.users
    update auth.users 
    set email = new_email, 
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object('deleted_original_email', current_email)
    where id = target_user_id;

    -- 4. Mark profile as deleted
    update public.profiles 
    set deleted_at = now()
    where id = target_user_id;
end;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_account(uuid) TO authenticated;
