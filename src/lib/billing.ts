/**
 * Interruptor de cobros. Mientras esté apagado la app es libre: no se pide
 * suscripción, no se muestran planes ni precios y no se carga la pasarela de pago.
 * Para volver a activar las suscripciones: VITE_BILLING_ENABLED=true en .env y
 * volver a construir la app.
 */
export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true'
