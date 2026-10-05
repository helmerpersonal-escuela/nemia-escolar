import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2, RefreshCw, RotateCcw, Settings2, ShieldCheck, Sparkles } from 'lucide-react'
import { WizardAlert } from '../../../components/wizard/Wizard'
import { formatDateEs } from '../../../components/ui/DateInput'
import type { SpaceAccess } from '../../../hooks/useSpaceAccess'
import {
    annualSaving, buyPlan, currentStore, loadStorePlans, openStoreManagement, periodLabel,
    storeErrorMessage, syncStore, toStoreError, type StorePlan,
} from '../../../lib/storeBilling'

type Notice = { tone: 'success' | 'error' | 'info' | 'warning'; text: string }

const INCLUDED = ['Planeación y programa analítico', 'Libreta, asistencia y evaluación', 'Reportes y formatos listos para imprimir', 'Comunicación con familias']

/**
 * Selección de plan dentro de la app (Android / iPhone).
 * Los precios vienen de la tienda, en la moneda del usuario; el cobro lo hace Google Play o App Store.
 */
export const StorePlans = ({ tenantId, access, onChanged }: { tenantId?: string; access: SpaceAccess; onChanged: () => void }) => {
    const store = currentStore()
    const storeName = store === 'APPLE' ? 'App Store' : 'Google Play'
    const { data: plans, isLoading, error, refetch, isFetching } = useQuery<StorePlan[]>({
        queryKey: ['store-plans', store],
        queryFn: loadStorePlans,
        staleTime: 10 * 60_000,
        retry: false,
    })
    const [selected, setSelected] = useState<string | null>(null)
    const [busy, setBusy] = useState<'buy' | 'restore' | 'manage' | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)

    const available = (plans ?? []).filter(p => p.product)
    const monthly = available.find(p => p.plan === 'MONTHLY')
    const annual = available.find(p => p.plan === 'ANNUAL')
    const saving = annualSaving(monthly?.product, annual?.product)

    // Por omisión, el plan anual (el que más conviene); si no existe, el primero
    useEffect(() => {
        if (!selected && available.length) setSelected((annual ?? available[0]).productId)
    }, [available.length]) // eslint-disable-line react-hooks/exhaustive-deps

    const chosen = available.find(p => p.productId === selected)
    const subscribed = access.has_access && access.status !== 'TRIAL' && (access.plan === 'MONTHLY' || access.plan === 'ANNUAL')

    const fail = (e: unknown) => {
        const err = toStoreError(e)
        const text = storeErrorMessage(err.code, store)
        // Cancelar la compra no es un error: no se muestra nada
        setNotice(text ? { tone: err.code === 'PENDING' || err.code === 'VERIFY_PENDING' ? 'warning' : 'error', text } : null)
    }

    const buy = async () => {
        if (!tenantId || !chosen || busy) return
        setBusy('buy'); setNotice(null)
        try {
            const outcome = await buyPlan(tenantId, chosen.productId)
            if (outcome.status === 'pending') {
                setNotice({ tone: 'info', text: 'Tu pago quedó pendiente de aprobación. El acceso se activa solo en cuanto se confirme; no necesitas volver a comprar.' })
            } else {
                setNotice({ tone: 'success', text: `¡Listo! Tu suscripción está activa${outcome.until ? ` hasta el ${formatDateEs(String(outcome.until).slice(0, 10))}` : ''}.` })
                onChanged()
            }
        } catch (e) {
            fail(e)
        } finally {
            setBusy(null)
        }
    }

    const restore = async () => {
        if (!tenantId || busy) return
        setBusy('restore'); setNotice(null)
        try {
            const r = await syncStore(tenantId, { ask: true })
            if (r.active) { setNotice({ tone: 'success', text: 'Recuperamos tu suscripción.' }); onChanged() }
            else if (r.errors.length) setNotice({ tone: 'error', text: storeErrorMessage(r.errors[0], store) ?? 'No se pudo restaurar la compra.' })
            else setNotice({ tone: 'info', text: r.found ? 'Tu suscripción anterior ya venció.' : `No encontramos compras en tu cuenta de ${storeName}.` })
        } catch (e) {
            fail(e)
        } finally {
            setBusy(null)
        }
    }

    const manage = async () => {
        if (busy) return
        setBusy('manage'); setNotice(null)
        try { await openStoreManagement(chosen?.productId) } catch (e) { fail(e) } finally { setBusy(null) }
    }

    const title = subscribed ? 'Tu plan' : access.status === 'TRIAL' && access.has_access ? 'Elige tu plan para cuando termine la prueba' : 'Activa tu suscripción'

    return (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5" aria-busy={!!busy}>
            <div>
                <h2 className="text-xl font-black text-slate-900">{title}</h2>
                <p className="text-sm text-slate-500 mt-1">Todas las herramientas incluidas en ambos planes. El cobro lo hace {storeName} con la forma de pago de tu cuenta.</p>
            </div>

            {isLoading && <div className="py-10 flex justify-center" role="status" aria-label="Cargando planes"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>}

            {!isLoading && (error || !available.length) && (
                <div className="space-y-3">
                    <WizardAlert tone="warning">
                        {error ? storeErrorMessage(toStoreError(error).code, store) ?? 'No se pudieron cargar los planes.' : `Los planes todavía no están disponibles en ${storeName}.`}
                    </WizardAlert>
                    <button type="button" onClick={() => refetch()} disabled={isFetching}
                        className="inline-flex items-center gap-2 min-h-11 px-4 rounded-2xl border border-slate-200 text-sm font-black text-slate-700 disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Reintentar
                    </button>
                </div>
            )}

            {available.length > 0 && (
                <>
                    <div role="radiogroup" aria-label="Planes" className="grid sm:grid-cols-2 gap-3">
                        {available.map(p => {
                            const on = selected === p.productId
                            const current = subscribed && access.plan === p.plan
                            return (
                                <button key={p.productId} type="button" role="radio" aria-checked={on} onClick={() => setSelected(p.productId)} disabled={!!busy}
                                    className={`text-left rounded-2xl border-2 p-4 sm:p-5 transition ${on ? 'border-indigo-600 bg-indigo-50/60' : 'border-slate-200'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-black text-slate-900">{p.name}</span>
                                        {current ? <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Tu plan actual</span>
                                            : p.plan === 'ANNUAL' && saving > 0 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">El que más conviene</span>}
                                    </div>
                                    <p className="mt-2"><span className="text-3xl font-black text-slate-900">{p.product!.price}</span> <span className="text-sm text-slate-500">/ {periodLabel(p.product!.period, p.months)}</span></p>
                                    <p className="text-xs text-slate-500 mt-1">Se renueva cada {periodLabel(p.product!.period, p.months)} hasta que la canceles.</p>
                                </button>
                            )
                        })}
                    </div>

                    <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-700">
                        {INCLUDED.map(t => <li key={t} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />{t}</li>)}
                    </ul>
                </>
            )}

            {notice && <WizardAlert tone={notice.tone}>{notice.text}</WizardAlert>}

            {available.length > 0 && (
                <button type="button" onClick={buy} disabled={!chosen || !tenantId || !!busy || (subscribed && access.plan === chosen?.plan)}
                    className="w-full inline-flex items-center justify-center gap-2 min-h-12 px-6 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-600/20 disabled:opacity-40">
                    {busy === 'buy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {busy === 'buy' ? 'Procesando…' : subscribed ? (access.plan === chosen?.plan ? 'Ya tienes este plan' : `Cambiar a ${chosen?.name ?? ''}`) : `Suscribirme por ${chosen?.product?.price ?? ''}`}
                </button>
            )}

            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={restore} disabled={!tenantId || !!busy}
                    className="inline-flex items-center gap-2 min-h-11 px-4 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-50">
                    {busy === 'restore' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Restaurar compras
                </button>
                {subscribed && (
                    <button type="button" onClick={manage} disabled={!!busy}
                        className="inline-flex items-center gap-2 min-h-11 px-4 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-50">
                        {busy === 'manage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />} Cancelar o cambiar en {storeName}
                    </button>
                )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                    El pago se carga a tu cuenta de {storeName} al confirmar la compra. La suscripción se renueva automáticamente por el mismo precio,
                    salvo que la canceles al menos 24 horas antes de que termine el periodo. Puedes cancelarla cuando quieras desde tu cuenta de {storeName}.
                    {' '}<Link to="/terminos" className="underline font-bold">Términos de uso</Link> · <Link to="/privacidad" className="underline font-bold">Aviso de privacidad</Link>
                </span>
            </p>
        </section>
    )
}
