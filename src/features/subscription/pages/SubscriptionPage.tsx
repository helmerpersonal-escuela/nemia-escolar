import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { BadgeCheck, Building2, CalendarClock, CheckCircle2, CreditCard, Gift, KeyRound, Loader2, Mail, RefreshCw, Send, ShieldCheck, Tag, XCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { PLAN_LABEL, SPACE_ACCESS_KEY, useSpaceAccess, type SpaceAccess } from '../../../hooks/useSpaceAccess'
import { WizardAlert, WizardField, wizardInput } from '../../../components/wizard/Wizard'
import { formatDateEs } from '../../../components/ui/DateInput'

interface Plan { code: 'MONTHLY' | 'ANNUAL'; name: string; price: number; months: number }
interface Quote { plan: string; base: number; discount: number; final: number; code: string | null; code_valid: boolean; code_message: string | null; discount_label: string | null }

const money = (n: number) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: Number(n) % 1 ? 2 : 0 })
const formatKey = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).replace(/(.{4})(?=.)/g, '$1-')

/**
 * Suscripción del espacio.
 *  - En la web: planes, código promocional, cobro automático y pago en Mercado Pago.
 *  - En la app (Android/iOS): no se muestra ningún precio ni enlace de pago (políticas de las tiendas);
 *    solo el estado, la activación de claves de licencia y los avisos por correo.
 */
export const SubscriptionPage = () => {
    const native = Capacitor.isNativePlatform()
    const { data: tenant } = useTenant()
    const { data: access, isLoading, refetch } = useSpaceAccess()
    const qc = useQueryClient()
    const [params, setParams] = useSearchParams()
    const payStatus = params.get('status')

    // Al volver de Mercado Pago: seguir consultando hasta que el webhook confirme el pago
    useEffect(() => {
        if (payStatus !== 'approved') return
        let n = 0
        const t = setInterval(() => { n++; void refetch(); if (n >= 12) clearInterval(t) }, 5000)
        return () => clearInterval(t)
    }, [payStatus, refetch])

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

            {payStatus === 'approved' && (
                <WizardAlert tone="success">
                    <b>¡Gracias!</b> Mercado Pago nos avisó de tu pago. Tu acceso se actualiza en unos segundos.
                    <button onClick={() => { setParams({}); void refetch() }} className="ml-2 underline font-bold">Actualizar</button>
                </WizardAlert>
            )}
            {payStatus === 'pending' && <WizardAlert tone="info">Tu pago está pendiente de confirmación (por ejemplo, pago en efectivo). Te avisaremos cuando se acredite.</WizardAlert>}
            {payStatus === 'failure' && <WizardAlert tone="error">El pago no se completó. Puedes intentarlo de nuevo con otro método.</WizardAlert>}

            <StatusCard access={access} native={native} onChanged={() => qc.invalidateQueries({ queryKey: [SPACE_ACCESS_KEY] })} tenantId={(tenant as any)?.id} />

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
                        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Mail className="w-5 h-5" /></div>
                                <div>
                                    <h2 className="font-black text-slate-900">Cómo continuar</h2>
                                    <p className="text-sm text-slate-600 mt-1">La contratación de la suscripción no está disponible dentro de la app. Te enviamos por correo las opciones para continuar, una semana antes de que termine tu periodo.</p>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <Checkout tenantId={(tenant as any)?.id} access={access} />
                    )}
                    <LicenseKeyCard onRedeemed={() => qc.invalidateQueries({ queryKey: [SPACE_ACCESS_KEY] })} />
                </>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------

const StatusCard = ({ access, native, onChanged, tenantId }: { access: SpaceAccess; native: boolean; onChanged: () => void; tenantId?: string }) => {
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const s = access.status
    const days = access.days_left ?? 0
    const badge = !access.has_access
        ? { text: s === 'TRIAL' || s === 'EXPIRED' && access.plan === 'TRIAL' ? 'Prueba terminada' : 'Vencida', tone: 'bg-rose-50 text-rose-700 border-rose-100', icon: XCircle }
        : s === 'TRIAL' ? { text: 'Prueba gratuita', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: Gift }
            : s === 'PAST_DUE' ? { text: 'Pago pendiente', tone: 'bg-amber-50 text-amber-800 border-amber-100', icon: CalendarClock }
                : { text: 'Activa', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: BadgeCheck }

    const cancel = async () => {
        if (!tenantId || !confirm('¿Desactivar el cobro automático? Conservas el acceso hasta el final del periodo pagado y te avisaremos antes de que venza.')) return
        setBusy(true); setErr(null)
        const { data, error } = await supabase.functions.invoke('billing', { body: { action: 'cancel_auto_renew', tenantId } })
        setBusy(false)
        if (error || (data as any)?.error) { setErr((data as any)?.error || error?.message || 'No se pudo desactivar'); return }
        onChanged()
    }

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
                    {access.in_grace && <p className="text-sm text-amber-700 mt-1">No se pudo realizar el cobro. Tienes unos días de gracia para actualizar tu forma de pago.</p>}
                    {!access.has_access && <p className="text-sm text-slate-600 mt-1">Tu información sigue guardada.{access.can_manage ? ' Activa tu suscripción para seguir trabajando.' : ''}</p>}
                </div>
                {access.has_access && s !== 'TRIAL' && (
                    <div className="text-right text-sm">
                        <p className={`font-black ${access.auto_renew ? 'text-emerald-700' : 'text-slate-600'} flex items-center gap-1.5 justify-end`}>
                            <RefreshCw className="w-4 h-4" /> Cobro automático {access.auto_renew ? 'activo' : 'desactivado'}
                        </p>
                        {access.price != null && !native && <p className="text-slate-500">{money(access.price)} por {access.plan === 'ANNUAL' ? 'año' : 'mes'}{access.promo_code ? ` · código ${access.promo_code}` : ''}</p>}
                        {access.auto_renew && access.can_manage && !native && (
                            <button onClick={cancel} disabled={busy} className="mt-2 text-xs font-bold text-slate-500 hover:text-rose-600 underline disabled:opacity-50">Desactivar cobro automático</button>
                        )}
                    </div>
                )}
            </div>
            {err && <div className="mt-3"><WizardAlert>{err}</WizardAlert></div>}
        </section>
    )
}

const Checkout = ({ tenantId, access }: { tenantId?: string; access: SpaceAccess }) => {
    const { data: plans = [] } = useQuery({
        queryKey: ['billing-plans'],
        staleTime: 30 * 60_000,
        queryFn: async () => {
            const { data } = await (supabase as any).from('billing_plans').select('code, name, price, months').eq('active', true).order('months')
            return (data ?? []) as Plan[]
        },
    })
    const [plan, setPlan] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL')
    const [code, setCode] = useState('')
    const [quote, setQuote] = useState<Quote | null>(null)
    const [checking, setChecking] = useState(false)
    const [autoRenew, setAutoRenew] = useState(true)
    const [email, setEmail] = useState('')
    const [paying, setPaying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => { void supabase.auth.getSession().then(({ data }) => setEmail(e => e || data.session?.user?.email || '')) }, [])
    // Si cambia el plan, se vuelve a validar el código
    useEffect(() => { if (quote?.code) void applyCode(quote.code) }, [plan]) // eslint-disable-line react-hooks/exhaustive-deps

    const selected = plans.find(p => p.code === plan)
    const monthly = plans.find(p => p.code === 'MONTHLY')
    const annualSaving = monthly && plans.find(p => p.code === 'ANNUAL') ? monthly.price * 12 - plans.find(p => p.code === 'ANNUAL')!.price : 0
    const final = quote && quote.plan === plan && quote.code_valid ? quote.final : selected?.price ?? 0

    const applyCode = async (value = code) => {
        const c = value.trim()
        if (!c) { setQuote(null); return }
        setChecking(true)
        const { data, error: e } = await supabase.rpc('billing_quote' as any, { p_plan: plan, p_code: c })
        setChecking(false)
        if (e) { setQuote(null); setError(e.message); return }
        setQuote(data as Quote)
    }

    const pay = async () => {
        if (!tenantId) return
        setError(null); setPaying(true)
        const { data, error: e } = await supabase.functions.invoke('billing', {
            body: { action: 'checkout', tenantId, plan, promoCode: quote?.code_valid ? quote.code : null, autoRenew, payerEmail: email },
        })
        const payload = data as any
        if (e || payload?.error || !payload?.init_point) {
            setPaying(false)
            let msg = payload?.error || e?.message || 'No se pudo iniciar el pago'
            try { const ctx = await (e as any)?.context?.json?.(); if (ctx?.error) msg = ctx.error } catch { /* sin detalle */ }
            setError(msg)
            return
        }
        window.location.href = payload.init_point
    }

    const title = access.status === 'TRIAL' && access.has_access ? 'Elige tu plan para cuando termine la prueba' : access.has_access ? 'Cambiar o renovar tu plan' : 'Activa tu suscripción'

    return (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
            <div>
                <h2 className="text-xl font-black text-slate-900">{title}</h2>
                <p className="text-sm text-slate-500 mt-1">Todas las herramientas incluidas en ambos planes. El pago se hace de forma segura en Mercado Pago.{access.status === 'TRIAL' && access.has_access ? ' Los días de prueba que te quedan se suman a tu plan.' : ''}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                {plans.map(p => {
                    const on = plan === p.code
                    return (
                        <button key={p.code} type="button" onClick={() => setPlan(p.code)}
                            className={`text-left rounded-2xl border-2 p-4 sm:p-5 transition ${on ? 'border-indigo-600 bg-indigo-50/60' : 'border-slate-200 hover:border-indigo-300'}`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-900">{p.name}</span>
                                {p.code === 'ANNUAL' && annualSaving > 0 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Ahorras {money(annualSaving)}</span>}
                            </div>
                            <p className="mt-2"><span className="text-3xl font-black text-slate-900">{money(p.price)}</span> <span className="text-sm text-slate-500">/ {p.months === 12 ? 'año' : 'mes'}</span></p>
                            {p.code === 'ANNUAL' && <p className="text-xs text-slate-500 mt-1">Equivale a {money(Math.round(p.price / 12))} al mes</p>}
                        </button>
                    )
                })}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <WizardField label="Código promocional" hint={quote?.code_message ?? 'Opcional'}>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input className={`${wizardInput} pl-10 uppercase`} value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setQuote(null) }}
                                onKeyDown={e => { if (e.key === 'Enter') void applyCode() }} placeholder="Ej. MAESTRO20" maxLength={30} />
                        </div>
                        <button type="button" onClick={() => applyCode()} disabled={!code.trim() || checking} className="px-4 rounded-2xl bg-slate-900 text-white text-sm font-black disabled:opacity-40">
                            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                        </button>
                    </div>
                </WizardField>
                <WizardField label="Correo de tu cuenta de Mercado Pago" hint="Debe ser el mismo con el que pagarás en Mercado Pago.">
                    <input className={wizardInput} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </WizardField>
            </div>
            {quote && !quote.code_valid && quote.code_message && <WizardAlert tone="warning">{quote.code_message}</WizardAlert>}
            {quote?.code_valid && <WizardAlert tone="success"><b>{quote.discount_label}</b> aplicado: pagas {money(quote.final)} en lugar de {money(quote.base)}.</WizardAlert>}

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer">
                <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} className="mt-1 w-5 h-5 accent-indigo-600" />
                <span>
                    <span className="block font-black text-slate-900 text-sm">Cobro automático {plan === 'ANNUAL' ? 'cada año' : 'cada mes'}</span>
                    <span className="block text-sm text-slate-500 mt-0.5">
                        {autoRenew
                            ? 'Mercado Pago cobra solo al renovar y no pierdes el acceso. Puedes desactivarlo cuando quieras.'
                            : 'Pagas este periodo una sola vez. Te avisaremos 7 días y 1 día antes de que venza para que renueves.'}
                    </span>
                </span>
            </label>

            {error && <WizardAlert>{error}</WizardAlert>}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <p className="text-sm text-slate-600 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Pago seguro en Mercado Pago</p>
                <button type="button" onClick={pay} disabled={paying || !selected || !email}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-600/20 disabled:opacity-40">
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    Pagar {money(final)} con Mercado Pago
                </button>
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

/** Escuelas: la anualidad depende del número de usuarios → solicitud de cotización a ventas. */
const SalesCard = ({ spaceName }: { spaceName: string }) => {
    const [form, setForm] = useState({ name: '', phone: '', users: '', message: '' })
    const [busy, setBusy] = useState(false)
    const [done, setDone] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const { data: teachers } = useQuery({
        queryKey: ['sales-users-count'],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession()
            const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', session?.user?.id ?? '').maybeSingle()
            if (!p?.tenant_id) return null
            const { count } = await supabase.from('profile_tenants').select('profile_id', { count: 'exact', head: true }).eq('tenant_id', p.tenant_id)
            return count ?? null
        },
    })
    useEffect(() => { if (teachers && !form.users) setForm(f => ({ ...f, users: String(teachers) })) }, [teachers]) // eslint-disable-line react-hooks/exhaustive-deps

    const send = async () => {
        setErr(null)
        if (!form.name.trim()) return setErr('Escribe tu nombre.')
        if (!form.phone.trim()) return setErr('Escribe un teléfono o WhatsApp para contactarte.')
        setBusy(true)
        const { data, error } = await supabase.rpc('request_sales_quote' as any, {
            p_name: form.name, p_phone: form.phone, p_users: form.users ? Number(form.users) : null, p_message: form.message || null,
        })
        setBusy(false)
        if (error) return setErr(error.message)
        if ((data as any)?.success) setDone(true)
    }

    return (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
                <div>
                    <h2 className="text-xl font-black text-slate-900">Licencia para tu escuela</h2>
                    <p className="text-sm text-slate-500 mt-1">La anualidad para escuelas depende del número de usuarios (docentes, directivos y personal). Solicita tu cotización y el equipo de ventas te contactará. Al contratar recibirás tu clave de licencia para activarla aquí mismo.</p>
                </div>
            </div>
            {done ? (
                <WizardAlert tone="success"><b>¡Solicitud enviada!</b> Ventas se comunicará contigo para la cotización de {spaceName}.</WizardAlert>
            ) : (
                <>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <WizardField label="Tu nombre" required><input className={wizardInput} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Profra. Ana López" /></WizardField>
                        <WizardField label="Teléfono o WhatsApp" required><input className={wizardInput} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="961 000 0000" /></WizardField>
                        <WizardField label="Número aproximado de usuarios" hint={teachers ? `Hoy tu espacio tiene ${teachers} usuario(s) registrados.` : undefined}>
                            <input className={wizardInput} type="number" min="1" value={form.users} onChange={e => setForm({ ...form, users: e.target.value })} />
                        </WizardField>
                        <WizardField label="Comentarios"><input className={wizardInput} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Turnos, número de grupos, etc." /></WizardField>
                    </div>
                    {err && <div className="mt-3"><WizardAlert>{err}</WizardAlert></div>}
                    <div className="flex justify-end mt-4">
                        <button onClick={send} disabled={busy} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm disabled:opacity-40">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Solicitar cotización
                        </button>
                    </div>
                </>
            )}
        </section>
    )
}
