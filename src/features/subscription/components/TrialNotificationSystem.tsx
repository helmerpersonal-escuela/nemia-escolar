import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { CalendarClock, X } from 'lucide-react'
import { useSpaceAccess } from '../../../hooks/useSpaceAccess'

/**
 * Aviso dentro de la app (una vez al día) cuando la prueba o el periodo pagado está por terminar.
 * Solo para quien administra la suscripción del espacio. Si hay cobro automático no se avisa.
 * En la app nativa no se muestran precios ni enlaces de pago (políticas de las tiendas).
 */
export const TrialNotificationSystem = () => {
    const { data: access } = useSpaceAccess()
    const navigate = useNavigate()
    const [visible, setVisible] = useState(false)
    const native = Capacitor.isNativePlatform()

    const days = access?.days_left ?? null
    const kind: 'trial' | 'renew' | 'failed' | null = !access?.can_manage || !access.has_access ? null
        : access.status === 'PAST_DUE' ? 'failed'
            : access.status === 'TRIAL' && days != null && days <= 7 ? 'trial'
                : (access.status === 'ACTIVE' || access.status === 'CANCELED') && !access.auto_renew && days != null && days <= 7 ? 'renew'
                    : null

    useEffect(() => {
        if (!kind) return
        const key = `vunlek_billing_notice_${access?.tenant_id}_${kind}`
        const today = new Date().toDateString()
        try {
            if (localStorage.getItem(key) === today) return
            localStorage.setItem(key, today)
        } catch { /* sin almacenamiento: se muestra igual */ }
        setVisible(true)
    }, [kind, access?.tenant_id])

    if (!visible || !kind) return null

    const title = kind === 'trial' ? 'Tu mes de prueba está por terminar' : kind === 'renew' ? 'Tu suscripción vence pronto' : 'No pudimos realizar el cobro'
    const when = days === 1 ? 'mañana' : days != null && days <= 0 ? 'hoy' : `en ${days} días`
    const text = kind === 'trial'
        ? `Tu prueba gratuita termina ${when}. Tu información se conserva; solo elige tu plan para seguir usando todas las herramientas.`
        : kind === 'renew'
            ? `Tu periodo termina ${when} y no tiene cobro automático.`
            : 'Mercado Pago no pudo cobrar tu suscripción. Tienes unos días de gracia para actualizar tu forma de pago.'

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40" role="dialog" aria-modal="true" aria-label={title}>
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative">
                <button aria-label="Cerrar" onClick={() => setVisible(false)} className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4"><CalendarClock className="w-6 h-6" /></div>
                <h3 className="text-xl font-black text-slate-900 pr-8">{title}</h3>
                <p className="text-sm text-slate-600 mt-2">{text}</p>
                {native && <p className="text-sm text-slate-600 mt-2">Te enviamos a tu correo cómo continuar.</p>}
                <div className="flex gap-2 mt-6">
                    <button onClick={() => setVisible(false)} className="flex-1 py-3 rounded-2xl text-sm font-black text-slate-600 hover:bg-slate-100">Entendido</button>
                    <button onClick={() => { setVisible(false); navigate('/suscripcion') }} className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700">
                        {native ? 'Ver mi suscripción' : kind === 'failed' ? 'Actualizar pago' : 'Ver planes'}
                    </button>
                </div>
            </div>
        </div>
    )
}
