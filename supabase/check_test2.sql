-- CHECK USER EXISTS AND PROFILE STATUS
-- 1. Check if the user was created (should exist if neutralize trigger worked)
-- 2. Check if profile exists (should NOT exist since trigger was empty)

SELECT count(*) as user_count, id, instance_id, email, raw_user_meta_data
FROM auth.users
WHERE email = 'test2@test.com'
GROUP BY id, instance_id, email, raw_user_meta_data;

-- Check profile
SELECT * FROM public.profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'test2@test.com');
