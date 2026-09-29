-- La política restrictiva de profiles no puede llevar subconsultas: la política de
-- UPDATE de profiles consulta profiles y Postgres lo marca como recursión infinita
-- (los usuarios no podían guardar su perfil). Se llama a la función directamente.
DROP POLICY IF EXISTS familia_lectura ON public.profiles;
CREATE POLICY familia_lectura ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id = auth.uid() OR NOT coalesce(tenant_id = ANY (public.family_only_tenants()), false));

DROP POLICY IF EXISTS familia_lectura ON public.profile_tenants;
CREATE POLICY familia_lectura ON public.profile_tenants AS RESTRICTIVE FOR SELECT TO authenticated
  USING (profile_id = auth.uid()
         OR NOT coalesce(tenant_id = ANY (public.family_only_tenants()), false)
         OR upper(role) NOT IN ('TUTOR', 'STUDENT'));
