-- NEUTRALIZE DETONATOR
-- Diagnosis: The handle_new_user trigger logic might be causing a crash even with the try/catch block (maybe resource limits or locks).
-- Solution: Completely EMPTY the trigger function so it does NOTHING. This verifies if the trigger logic is truly the culprit.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- DO NOTHING. Just return the new user row.
  -- This effectively disables the trigger logic without needing to DROP/DISABLE the trigger itself (which requires permissions).
  RETURN NEW;
END;
$$;
