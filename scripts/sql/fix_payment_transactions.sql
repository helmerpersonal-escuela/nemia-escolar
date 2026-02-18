DO $$ 
BEGIN
    -- Drop the old constraint pointing to auth.users (if it exists under this name or similar)
    -- We'll try to drop by name if we know it, otherwise we might need to find it.
    -- Assuming standard naming convention: payment_transactions_user_id_fkey
    ALTER TABLE public.payment_transactions
      DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;

    -- Add the new constraint pointing to public.profiles
    -- This enables PostgREST to detect the relationship for: select('*, profiles:user_id(...)')
    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id);

EXCEPTION
    WHEN OTHERS THEN
       RAISE NOTICE 'Error correcting foreign key: %', SQLERRM;
END $$;
