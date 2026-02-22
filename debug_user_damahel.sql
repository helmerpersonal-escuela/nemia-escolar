
select 
  u.id as user_id,
  u.email,
  p.tenant_id as profile_tenant_id,
  p.role,
  t.name as tenant_name,
  t.type as tenant_type
from auth.users u
left join public.profiles p on p.id = u.id
left join public.tenants t on t.id = p.tenant_id
where u.email = 'damahel2017@gmail.com';
