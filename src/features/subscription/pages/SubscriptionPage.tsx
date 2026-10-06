import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { BadgeCheck, Building2, CalendarClock, CheckCircle2, Gift, KeyRound, Loader2, RefreshCw, Send, Smartphone, XCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { PLAN_LABEL, SPACE_ACCESS_KEY, useSpaceAccess, type SpaceAccess } from '../../../hooks/useSpaceAccess'
import { WizardAlert, WizardField, wizardInput } from '../../../components/wizard/Wizard'
import { formatDateEs } from '../../../components/ui/DateInput'
import { StorePlans } from '../components/StorePlans'

interface Plan { code: 'MONTHLY' | 'ANNUAL'; name: string; price: number; months: number }
interface Quote { plan: string; base: number; discount: number; final: number; code: string | null; code_valid: boolean; code_message: string | null; discount_label: string | null }

const money = (n: number) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: Number(n) % 1 ? 2 : 0 })
const formatKey = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).replace(/(.{4})(?=.)/g, '$1-')

/**
 * Suscripción del espacio.
 *  - En la app (Android / iPhone): selección de plan y compra con Google Play o App Store.
 *  - En la web: estado de la suscripción y activación de claves de licencia.
 *  - Escuelas: cotización con ventas (la anualidad depende del número de usuarios).
 */
export const SubscriptionPage = () => {
    const native = Capacitor.isNativePlatform()
    const { data: tenant } = useTenant()
    const { data: access, isLoading, refetch } = useSpaceAccess()
    const qc = useQueryClient()
    const spaceName = (tenant as any)?.name ?? 'tu espacio'
    if (isLoading || !access) {
        return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    }

    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-10 space-y-5">
            <header>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600 mb-1">Suscripción</p>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{spaceName}</h1>
            </header>

            <StatusCard access={access} native={native} />

            {!access.can_manage ? (
                <WizardAlert tone="info">
                    La suscripción de este espacio la administra la dirección de tu escuela.
                    {!access.has_access && ' Pídele que la renueve para recuperar el acceso.'}
                </WizardAlert>
            ) : (
                <>
                    {access.tenant_type === 'SCHOOL' ? (
                        <SalesCard spaceName={spaceName} />
                    ) : native ? (
                        <StorePlans tenantId={(tenant as any)?.id} access={access} onChanged={() => qc.invalidateQueries({ queryKey: [SPACE_ACCESS_KEY] })} />
                    ) : (
                        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Smartphone className="w-5 h-5" /></div>
                                <div>
                                    <h2 className="font-black text-slate-900">Contrata desde la app</h2>
                                    <p className="text-sm text-slate-600 mt-1">La suscripción se contrata y se administra desde la app de VUNLEK en tu celular (Android o iPhone). Lo que contrates ahí se refleja aquí con la misma cuenta.</p>
                                </div>
                            </div>
                        </section>
                    )}
                    <LicenseKeyCard onRedeemed={() => qc.invalidateQueries({ queryKey: [SPACE_ACCESS_KEY] })} />
                </>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------

const StatusCard = ({ access, native }: { access: SpaceAccess; native: boolean }) => {
    const s = access.status
    const days = access.days_left ?? 0
    const badge = !access.has_access
        ? { text: s === 'TRIAL' || s === 'EXPIRED' && access.plan === 'TRIAL' ? 'Prueba terminada' : 'Vencida', tone: 'bg-rose-50 text-rose-700 border-rose-100', icon: XCircle }
        : s === 'TRIAL' ? { text: 'Prueba gratuita', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: Gift }
            : s === 'PAST_DUE' ? { text: 'Pago pendiente', tone: 'bg-amber-50 text-amber-800 border-amber-100', icon: CalendarClock }
                : { text: 'Activa', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: BadgeCheck }

    return (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black ${badge.tone}`}>
                        <badge.icon className="w-3.5 h-3.5" /> {badge.text}
                    </span>
                    <p className="text-lg font-black text-slate-900 mt-2">
                        {access.plan ? PLAN_LABEL[access.plan] ?? access.plan : '—'}
                        {access.has_access && access.ends_at && (
                            <span className="text-slate-500 font-bold text-sm"> · {s === 'TRIAL' ? 'termina' : access.auto_renew ? 'se renueva' : 'vence'} el {formatDateEs(access.ends_at.slice(0, 10))}</span>
                        )}
                    </p>
                    {access.has_access && s === 'TRIAL' && (
                        <p className="text-sm text-slate-600 mt-1">Te quedan <b>{days} {days === 1 ? 'día' : 'días'}</b> de prueba con todas las herramientas.</p>
                    )}
                    {access.in_grace && <p className="text-sm text-amber-700 mt-1">No se pudo realizar el cobro. Tienes unos días de gracia para actualizar tu forma de pago en la tienda.</p>}
                    {!access.has_access && <p className="text-sm text-slate-600 mt-1">Tu información sigue guardada.{access.can_manage ? ' Activa tu suscripción para seguir trabajando.' : ''}</p>}
                </div>
                {access.has_access && s !== 'TRIAL' && (
                    <div className="text-right text-sm">
                        <p className={`font-black ${access.auto_renew ? 'text-emerald-700' : 'text-slate-600'} flex items-center gap-1.5 justify-end`}>
                            <RefreshCw className="w-4 h-4" /> Renovación automática {access.auto_renew ? 'activa' : 'desactivada'}
                        </p>
                        {access.price != null && !native && <p className="text-slate-500">{money(access.price)} por {access.plan === 'ANNUAL' ? 'año' : 'mes'}{access.promo_code ? ` · código ${access.promo_code}` : ''}</p>}
                    </div>
                )}
            </div>
        </section>
    )
}

const LicenseKeyCard = ({ onRedeemed }: { onRedeemed: () => void }) => {
    const [key, setKey] = useState('')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
    const clean = useMemo(() => key.replace(/-/g, ''), [key])

    const redeem = async () => {
        setBusy(true); setMsg(null)
        const { data, error } = await supabase.rpc('redeem_license_key' as any, { p_key: clean })
        setBusy(false)
        const r = data as any
        if (error) return setMsg({ tone: 'error', text: error.message })
        if (!r?.success) return setMsg({ tone: 'error', text: r?.error ?? 'La clave no es válida' })
        setKey('')
        setMsg({ tone: 'success', text: `Licencia activada: ${r.months} meses. Tu acceso vence el ${formatDateEs(String(r.until).slice(0, 10))}.` })
        onRedeemed()
    }

    return (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
                <div>
                    <h2 className="font-black text-slate-900">¿Tienes una clave de licencia?</h2>
                    <p className="text-sm text-slate-500">Claves de 12 caracteres por 3, 6 o 12 meses (por ejemplo, las que entrega tu zona escolar o un distribuidor). Se suman a tu periodo actual.</p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <input className={`${wizardInput} font-mono tracking-widest uppercase sm:flex-1`} value={key} onChange={e => setKey(formatKey(e.target.value))}
                    placeholder="XXXX-XXXX-XXXX" inputMode="text" autoCapitalize="characters" aria-label="Clave de licencia" />
                <button type="button" onClick={redeem} disabled={clean.length !== 12 || busy}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Activar
                </button>
            </div>
            {msg && <div className="mt-3"><WizardAlert tone={msg.tone}>{msg.text}</WizardAlert></div>}
        </section>
    )
}

/** Escuelas: el costo depende del número de docentes y alumnos → solicitud de presupuesto a ventas. */
const SalesCard = ({ spaceName }: { spaceName: string }) => (
    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-start gap-3">
            <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
            <div>
                <h2 className="text-xl font-black text-slate-900">Licencia para {spaceName}</h2>
                <p className="text-sm text-slate-500 mt-1">El costo para escuelas depende del número de docentes y alumnos. Solicita tu presupuesto y el equipo de ventas te contactará. Al contratar recibirás tu clave de licencia para activarla aquí.</p>
                <Link to="/presupuesto" className="mt-4 inline-flex items-center gap-2 min-h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm"><Send className="w-4 h-4" /> Solicitar presupuesto</Link>
            </div>
        </div>
    </section>
)
