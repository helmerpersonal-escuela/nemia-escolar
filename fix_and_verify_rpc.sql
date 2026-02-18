-- =================================================================
-- SCRIPT: REPARACIÓN Y VERIFICACIÓN DE RPC (start_free_trial)
-- =================================================================

BEGIN;

-- 1. Borrar versión anterior (para asegurar limpieza)
DROP FUNCTION IF EXISTS public.start_free_trial(text);

-- 2. Recrear la función
CREATE OR REPLACE FUNCTION public.start_free_trial(
  p_plan_type text DEFAULT 'basic'
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_subscription_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
  VALUES (
    v_user_id, 
    'active',
    p_plan_type,
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET status = 'active', 
      plan_type = EXCLUDED.plan_type, 
      current_period_end = CASE 
        WHEN subscriptions.current_period_end < NOW() THEN NOW() + INTERVAL '30 days'
        ELSE subscriptions.current_period_end
      END
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Asignar Permisos (CRÍTICO)
REVOKE ALL ON FUNCTION public.start_free_trial(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_free_trial(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_free_trial(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_free_trial(text) TO anon; -- Solo para probar si el error es de auth

COMMIT;

-- 4. Forzar recarga de caché
NOTIFY pgrst, 'reload schema';

-- 5. VERIFICACIÓN (Esto debe mostrar una fila si se creó bien)
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'start_free_trial';
