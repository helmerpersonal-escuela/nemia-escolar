import { useNavigate } from 'react-router-dom'
import { ArrowRight, CreditCard, Loader2 } from 'lucide-react'
import { PLAN_LABEL, useSpaceAccess } from '../../../hooks/useSpaceAccess'
import { formatDateEs } from '../../../components/ui/DateInput'

/** Resumen de la suscripción del espacio en Ajustes. La gestión completa vive en /suscripcion. */
export const BillingSection = () => {
    const { data: access, isLoading } = useSpaceAccess()
    const navigate = useNavigate()
    if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
    if (!access) return null
    const status = !access.has_access ? 'Vencida' : access.status === 'TRIAL' ? 'Prueba gratuita' : access.status === 'PAST_DUE' ? 'Pago pendiente' : 'Activa'
    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><CreditCard className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-slate-900">Suscripción del espacio</h2>
                    <p className="text-sm text-slate-600 mt-1">
                        <b>{status}</b>{access.plan ? ` · ${PLAN_LABEL[access.plan] ?? access.plan}` : ''}
                        {access.ends_at ? ` · ${access.status === 'TRIAL' ? 'termina' : access.auto_renew ? 'se renueva' : 'vence'} el ${formatDateEs(access.ends_at.slice(0, 10))}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Todas las herramientas incluidas, sin límite de grupos ni alumnos.</p>
                </div>
            </div>
            <div className="flex justify-end mt-4">
                <button onClick={() => navigate('/suscripcion')} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700">
                    {access.can_manage ? 'Administrar suscripción' : 'Ver detalles'} <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
