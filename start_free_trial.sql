-- FUNCTION: start_free_trial
-- Permite iniciar una prueba gratuita de 30 días sin pasarillo de pago.

CREATE OR REPLACE FUNCTION public.start_free_trial(
  p_plan_type text DEFAULT 'basic'
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_subscription_id uuid;
BEGIN
  -- 1. Obtener ID del usuario autenticado
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- 2. (Opcional) Verificar si ya tuvo prueba
  -- Por ahora permitimos reactivar si no tiene activa
  
  -- 3. Crear suscripción
  INSERT INTO public.subscriptions (user_id, status, plan_type, current_period_end)
  VALUES (
    v_user_id, 
    'active',      -- Estado activo para que tenga acceso
    p_plan_type,   -- 'basic' o 'pro'
    NOW() + INTERVAL '30 days' -- 30 días gratis
  )
  ON CONFLICT (user_id) DO UPDATE
  SET status = 'active', 
      plan_type = EXCLUDED.plan_type, 
      current_period_end = CASE 
        WHEN subscriptions.current_period_end < NOW() THEN NOW() + INTERVAL '30 days' -- Solo renueva si ya venció
        ELSE subscriptions.current_period_end -- Si tiene tiempo, lo respeta (o se podría sumar)
      END
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.start_free_trial(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_free_trial(text) TO service_role;

-- Force schema cache reload (Critical for PGRST202 errors)
NOTIFY pgrst, 'reload schema';
