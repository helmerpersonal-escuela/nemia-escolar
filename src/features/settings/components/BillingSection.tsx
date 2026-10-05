import { useNavigate } from 'react-router-dom'
import { ArrowRight, CreditCard, Loader2 } from 'lucide-react'
import { BILLING_ENABLED } from '../../../lib/billing'
import { PLAN_LABEL, useSpaceAccess } from '../../../hooks/useSpaceAccess'
import { formatDateEs } from '../../../components/ui/DateInput'
import { SettingsCard, SettingsActionButton } from './SettingsUI'

/** Resumen de la suscripción del espacio en Ajustes. La gestión completa vive en /suscripcion. */
export const BillingSection = () => {
    const { data: access, isLoading } = useSpaceAccess()
    const navigate = useNavigate()
    if (!BILLING_ENABLED) return null
    if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
    if (!access) return null
    const status = !access.has_access ? 'Vencida' : access.status === 'TRIAL' ? 'Prueba gratuita' : access.status === 'PAST_DUE' ? 'Pago pendiente' : 'Activa'
    return (
        <SettingsCard icon={CreditCard} title="Suscripción del espacio"
            hint={<><b>{status}</b>{access.plan ? ` · ${PLAN_LABEL[access.plan] ?? access.plan}` : ''}{access.ends_at ? ` · ${access.status === 'TRIAL' ? 'termina' : access.auto_renew ? 'se renueva' : 'vence'} el ${formatDateEs(access.ends_at.slice(0, 10))}` : ''}</>}
            action={<SettingsActionButton icon={ArrowRight} onClick={() => navigate('/suscripcion')}>{access.can_manage ? 'Administrar suscripción' : 'Ver detalles'}</SettingsActionButton>}>
            <p className="text-sm text-slate-500">Todas las herramientas incluidas, sin límite de grupos ni alumnos.</p>
        </SettingsCard>
    )
}
