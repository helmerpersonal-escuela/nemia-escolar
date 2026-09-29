-- Las alertas de tareas (student_alerts) son para la familia: la app las crea y
-- las marca como leídas desde la cuenta del padre. Se permiten solo las propias.
DROP POLICY IF EXISTS familia_lectura ON public.student_alerts;
DROP POLICY IF EXISTS familia_alta ON public.student_alerts;
DROP POLICY IF EXISTS familia_cambio ON public.student_alerts;
DROP POLICY IF EXISTS familia_baja ON public.student_alerts;

CREATE POLICY familia_lectura ON public.student_alerts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false) OR tutor_id = auth.uid());
CREATE POLICY familia_alta ON public.student_alerts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false)
              OR (tutor_id = auth.uid() AND student_id = ANY ((SELECT public.my_student_ids())::uuid[])));
CREATE POLICY familia_cambio ON public.student_alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false) OR tutor_id = auth.uid());
CREATE POLICY familia_baja ON public.student_alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT coalesce(tenant_id = ANY ((SELECT public.family_only_tenants())::uuid[]), false));
