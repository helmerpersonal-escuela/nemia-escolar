SELECT 
    au.email,
    pr.role
FROM auth.users au
JOIN public.profile_roles pr ON pr.profile_id = au.id
WHERE au.email = 'helmerpersonal@outlook.com';
