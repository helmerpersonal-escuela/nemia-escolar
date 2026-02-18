
-- Check for the user in all relevant tables
SELECT id, email, role FROM public.profiles WHERE email = 'helmerpersonal@gmail.com';
SELECT id, email, created_at FROM auth.users WHERE email = 'helmerpersonal@gmail.com';
SELECT id, email, first_name FROM public.students WHERE email = 'helmerpersonal@gmail.com';
