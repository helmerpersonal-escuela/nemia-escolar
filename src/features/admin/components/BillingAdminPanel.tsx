import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Building2, Copy, Download, KeyRound, Loader2, Mail, Plus, Save, Tag, Timer } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { wizardInput } from '../../../components/wizard/Wizard'

const db = supabase as any
const input = wizardInput.replace('px-4 py-3', 'px-3 py-2.5')
const money = (n: number) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const date = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtKey = (k: string) => k.replace(/(.{4})(?=.)/g, '$1-')

const Card = ({ title, icon: Icon, children, action }: { title: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) => (
    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-black text-slate-900 flex items-center gap-2"><Icon className="w-5 h-5 text-indigo-600" /> {title}</h3>
            {action}
        </div>
        {children}
    </section>
)

const Label = ({ children }: { children: React.ReactNode }) => <span className="block text-[11px] font-black text-slate-500 mb-1">{children}</span>

/** Modo dios · Suscripciones de los espacios, planes y avisos. */
export const SpaceSubscriptionsPanel = ({ search = '' }: { search?: string }) => {
    const qc = useQueryClient()
    const [busy, setBusy] = useState<string | null>(null)
    const { data: subs = [], isLoading } = useQuery({
        queryKey: ['god', 'space-subs'],
        queryFn: async () => {
            const { data, error } = await db.from('space_subscriptions').select('*, tenant:tenants(name, type, created_at)').order('updated_at', { ascending: false }).limit(500)
            if (error) throw error
            return data as any[]
        },
    })
    const { data: plans = [] } = useQuery({
        queryKey: ['god', 'plans'],
        queryFn: async () => ((await db.from('billing_plans').select('*').order('months')).data ?? []) as any[],
    })
    const { data: pending = 0 } = useQuery({
        queryKey: ['god', 'notices-pending'],
        queryFn: async () => (await db.from('billing_notices').select('id', { count: 'exact', head: true }).is('sent_at', null)).count ?? 0,
    })
    const [prices, setPrices] = useState<Record<string, string>>({})

    const extend = async (tenantId: string, s: any, days: number) => {
        setBusy(tenantId)
        const trial = s.status === 'TRIAL' || (s.status === 'EXPIRED' && s.plan === 'TRIAL')
        const base = new Date(Math.max(Date.now(), new Date((trial ? s.trial_ends_at : s.current_period_end) ?? Date.now()).getTime()))
        base.setDate(base.getDate() + days)
        const patch = trial
            ? { status: 'TRIAL', trial_ends_at: base.toISOString(), notices: {} }
            : { status: 'ACTIVE', current_period_end: base.toISOString(), notices: {} }
        await db.from('space_subscriptions').update({ ...patch, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId)
        await db.from('billing_events').insert({ tenant_id: tenantId, kind: 'GOD_EXTEND', detail: { days } })
        setBusy(null)
        qc.invalidateQueries({ queryKey: ['god', 'space-subs'] })
    }

    const savePrice = async (code: string) => {
        const v = Number(prices[code])
        if (!v || v <= 0) return
        await db.from('billing_plans').update({ price: v, updated_at: new Date().toISOString() }).eq('code', code)
        setPrices(p => ({ ...p, [code]: '' }))
        qc.invalidateQueries({ queryKey: ['god', 'plans'] })
    }

    const sendNow = async () => {
        setBusy('notify')
        const { data, error } = await supabase.functions.invoke('billing-notify', { body: {} })
        setBusy(null)
        alert(error ? `Error: ${error.message}` : (data as any)?.message ?? `Enviados: ${(data as any)?.sent ?? 0}`)
        qc.invalidateQueries({ queryKey: ['god', 'notices-pending'] })
    }

    const q = search.trim().toLowerCase()
    const list = subs.filter(s => !q || String(s.tenant?.name ?? '').toLowerCase().includes(q))
    const count = (st: string) => subs.filter(s => s.status === st).length
    const statusTone: Record<string, string> = {
        TRIAL: 'bg-indigo-50 text-indigo-700', ACTIVE: 'bg-emerald-50 text-emerald-700', PAST_DUE: 'bg-amber-50 text-amber-800',
        EXPIRED: 'bg-rose-50 text-rose-700', CANCELED: 'bg-slate-100 text-slate-600',
    }

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[['TRIAL', 'En prueba'], ['ACTIVE', 'Activas'], ['PAST_DUE', 'Pago pendiente'], ['CANCELED', 'Sin renovación'], ['EXPIRED', 'Vencidas']].map(([k, l]) => (
                    <div key={k} className="bg-white rounded-2xl border border-slate-100 p-4">
                        <div className="text-2xl font-black text-slate-900">{count(k)}</div>
                        <div className="text-xs font-bold text-slate-500">{l}</div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
                <Card title="Precios de los planes" icon={Tag}>
                    <div className="space-y-3">
                        {plans.map(p => (
                            <div key={p.code} className="flex items-end gap-2">
                                <div className="flex-1">
                                    <Label>{p.name} · actual {money(p.price)}</Label>
                                    <input className={input} type="number" min="1" step="1" placeholder={String(p.price)} value={prices[p.code] ?? ''} onChange={e => setPrices({ ...prices, [p.code]: e.target.value })} />
                                </div>
                                <button onClick={() => savePrice(p.code)} disabled={!prices[p.code]} className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40"><Save className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <p className="text-xs text-slate-500">Los cobros automáticos ya creados conservan su precio; el nuevo precio aplica a las siguientes contrataciones.</p>
                    </div>
                </Card>
                <Card title="Avisos por correo" icon={Mail} action={<button onClick={sendNow} disabled={busy === 'notify'} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-40">{busy === 'notify' ? 'Enviando…' : 'Enviar ahora'}</button>}>
                    <p className="text-sm text-slate-600"><b>{pending}</b> aviso(s) en cola. Se envían solos todos los días a las 8:05 (hora del centro) con Resend.</p>
                    <p className="text-xs text-slate-500 mt-2">Avisos: 7 días y 1 día antes de terminar la prueba o el periodo (si no hay cobro automático), al vencer y si falla un cobro.</p>
                </Card>
            </div>

            <SalesLeadsCard />

            <Card title="Espacios" icon={Timer}>
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> : list.length === 0 ? <p className="text-sm text-slate-500">Aún no hay espacios.</p> : (
                    <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
                        <table className="w-full text-sm min-w-[720px]">
                            <thead><tr className="text-left text-xs text-slate-500">
                                <th className="py-2 pr-2">Espacio</th><th className="py-2 pr-2">Estado</th><th className="py-2 pr-2">Plan</th><th className="py-2 pr-2">Vence</th><th className="py-2 pr-2">Cobro</th><th className="py-2">Cortesía</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {list.map(s => (
                                    <tr key={s.tenant_id}>
                                        <td className="py-2 pr-2"><div className="font-bold text-slate-800">{s.tenant?.name ?? s.tenant_id}</div><div className="text-xs text-slate-400">{s.tenant?.type === 'INDEPENDENT' ? 'Docente independiente' : 'Escuela'} · desde {date(s.tenant?.created_at)}</div></td>
                                        <td className="py-2 pr-2"><span className={`px-2 py-1 rounded-full text-xs font-black ${statusTone[s.status] ?? ''}`}>{s.status}</span></td>
                                        <td className="py-2 pr-2">{s.plan}{s.promo_code ? <span className="text-xs text-slate-400"> · {s.promo_code}</span> : null}</td>
                                        <td className="py-2 pr-2">{date(s.status === 'TRIAL' ? s.trial_ends_at : s.current_period_end)}</td>
                                        <td className="py-2 pr-2">{s.auto_renew ? `Automático ${s.price ? money(s.price) : ''}` : '—'}</td>
                                        <td className="py-2">
                                            <div className="flex gap-1">
                                                {[7, 30].map(d => <button key={d} onClick={() => extend(s.tenant_id, s, d)} disabled={busy === s.tenant_id} className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-xs font-black disabled:opacity-40">+{d} d</button>)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    )
}

/** Modo dios · Códigos promocionales y claves de licencia. */
export const PromoAndLicensesPanel = () => {
    const qc = useQueryClient()
    const [promo, setPromo] = useState({ code: '', description: '', discount_type: 'PERCENT', discount_value: '', applies_to: 'ALL', max_uses: '', valid_until: '' })
    const [gen, setGen] = useState({ months: 12, count: 10, note: '' })
    const [fresh, setFresh] = useState<string[]>([])
    const [busy, setBusy] = useState<string | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [keyFilter, setKeyFilter] = useState<'AVAILABLE' | 'REDEEMED' | 'REVOKED' | 'ALL'>('AVAILABLE')

    const { data: promos = [] } = useQuery({
        queryKey: ['god', 'promos'],
        queryFn: async () => ((await db.from('promo_codes').select('*').order('created_at', { ascending: false })).data ?? []) as any[],
    })
    const { data: keys = [] } = useQuery({
        queryKey: ['god', 'keys', keyFilter],
        queryFn: async () => {
            let q = db.from('license_keys').select('*, tenant:tenants(name)').order('created_at', { ascending: false }).limit(300)
            if (keyFilter !== 'ALL') q = q.eq('status', keyFilter)
            return ((await q).data ?? []) as any[]
        },
    })

    const createPromo = async () => {
        setErr(null)
        const code = promo.code.trim().toUpperCase()
        const value = Number(promo.discount_value)
        if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return setErr('El código debe tener de 3 a 30 letras, números, guion o guion bajo.')
        if (!value || value <= 0 || (promo.discount_type === 'PERCENT' && value > 100)) return setErr('Revisa el descuento.')
        setBusy('promo')
        const { error } = await db.from('promo_codes').insert({
            code, description: promo.description || null, discount_type: promo.discount_type, discount_value: value,
            applies_to: promo.applies_to, max_uses: promo.max_uses ? Number(promo.max_uses) : null, valid_until: promo.valid_until || null,
        })
        setBusy(null)
        if (error) return setErr(error.message.includes('duplicate') ? 'Ese código ya existe.' : error.message)
        setPromo({ code: '', description: '', discount_type: 'PERCENT', discount_value: '', applies_to: 'ALL', max_uses: '', valid_until: '' })
        qc.invalidateQueries({ queryKey: ['god', 'promos'] })
    }
    const togglePromo = async (p: any) => {
        await db.from('promo_codes').update({ active: !p.active }).eq('id', p.id)
        qc.invalidateQueries({ queryKey: ['god', 'promos'] })
    }

    const generate = async () => {
        setErr(null); setBusy('gen')
        const { data, error } = await db.rpc('admin_generate_license_keys', { p_months: gen.months, p_count: gen.count, p_note: gen.note || null })
        setBusy(null)
        if (error) return setErr(error.message)
        setFresh((data ?? []).map((k: any) => k.key))
        qc.invalidateQueries({ queryKey: ['god', 'keys'] })
    }
    const revoke = async (id: string) => {
        if (!confirm('¿Revocar esta clave? Ya no se podrá activar.')) return
        await db.from('license_keys').update({ status: 'REVOKED' }).eq('id', id).eq('status', 'AVAILABLE')
        qc.invalidateQueries({ queryKey: ['god', 'keys'] })
    }
    const exportCsv = (rows: any[]) => {
        const csv = ['clave,meses,estado,nota,creada,espacio,canjeada', ...rows.map(k => [fmtKey(k.key), k.months, k.status, `"${(k.note ?? '').replace(/"/g, '""')}"`, date(k.created_at), `"${(k.tenant?.name ?? '').replace(/"/g, '""')}"`, date(k.redeemed_at)].join(','))].join('\n')
        const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
        const a = document.createElement('a'); a.href = url; a.download = `claves_vunlek_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
    }

    return (
        <div className="space-y-5">
            {err && <div className="rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold px-4 py-3">{err}</div>}
            <div className="grid lg:grid-cols-2 gap-5">
                <Card title="Generar claves de licencia" icon={KeyRound}>
                    <div className="grid grid-cols-3 gap-3">
                        <label><Label>Vigencia</Label>
                            <select className={input} value={gen.months} onChange={e => setGen({ ...gen, months: Number(e.target.value) })}>
                                <option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option>
                            </select>
                        </label>
                        <label><Label>Cantidad</Label><input className={input} type="number" min={1} max={500} value={gen.count} onChange={e => setGen({ ...gen, count: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} /></label>
                        <label><Label>Nota / lote</Label><input className={input} value={gen.note} onChange={e => setGen({ ...gen, note: e.target.value })} placeholder="Zona 05" /></label>
                    </div>
                    <button onClick={generate} disabled={busy === 'gen'} className="mt-3 w-full py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40 inline-flex items-center justify-center gap-2">
                        {busy === 'gen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Generar {gen.count} clave(s) de {gen.months} meses
                    </button>
                    {fresh.length > 0 && (
                        <div className="mt-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-black text-slate-600">Claves nuevas</span>
                                <button onClick={() => navigator.clipboard?.writeText(fresh.map(fmtKey).join('\n'))} className="text-xs font-black text-indigo-700 inline-flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copiar todas</button>
                            </div>
                            <div className="grid grid-cols-2 gap-1 font-mono text-sm max-h-48 overflow-y-auto">{fresh.map(k => <span key={k}>{fmtKey(k)}</span>)}</div>
                        </div>
                    )}
                </Card>

                <Card title="Nuevo código promocional" icon={Tag}>
                    <div className="grid grid-cols-2 gap-3">
                        <label><Label>Código</Label><input className={`${input} uppercase`} value={promo.code} onChange={e => setPromo({ ...promo, code: e.target.value.toUpperCase() })} placeholder="MAESTRO20" /></label>
                        <label><Label>Aplica a</Label>
                            <select className={input} value={promo.applies_to} onChange={e => setPromo({ ...promo, applies_to: e.target.value })}>
                                <option value="ALL">Mensual y anual</option><option value="MONTHLY">Solo mensual</option><option value="ANNUAL">Solo anual</option>
                            </select>
                        </label>
                        <label><Label>Tipo</Label>
                            <select className={input} value={promo.discount_type} onChange={e => setPromo({ ...promo, discount_type: e.target.value })}>
                                <option value="PERCENT">Porcentaje (%)</option><option value="AMOUNT">Monto ($)</option>
                            </select>
                        </label>
                        <label><Label>Descuento</Label><input className={input} type="number" min="1" value={promo.discount_value} onChange={e => setPromo({ ...promo, discount_value: e.target.value })} placeholder={promo.discount_type === 'PERCENT' ? '20' : '100'} /></label>
                        <label><Label>Usos máximos</Label><input className={input} type="number" min="1" value={promo.max_uses} onChange={e => setPromo({ ...promo, max_uses: e.target.value })} placeholder="Sin límite" /></label>
                        <label><Label>Vence</Label><input className={input} type="date" value={promo.valid_until} onChange={e => setPromo({ ...promo, valid_until: e.target.value })} /></label>
                        <label className="col-span-2"><Label>Descripción (la ve el cliente)</Label><input className={input} value={promo.description} onChange={e => setPromo({ ...promo, description: e.target.value })} placeholder="Descuento para docentes de Chiapas" /></label>
                    </div>
                    <button onClick={createPromo} disabled={busy === 'promo'} className="mt-3 w-full py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40">Crear código</button>
                    <p className="text-xs text-slate-500 mt-2">Con cobro automático, el descuento se mantiene en cada renovación.</p>
                </Card>
            </div>

            <Card title="Códigos promocionales" icon={Tag}>
                {promos.length === 0 ? <p className="text-sm text-slate-500">Sin códigos.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                        <thead><tr className="text-left text-xs text-slate-500"><th className="py-2">Código</th><th>Descuento</th><th>Aplica</th><th>Usos</th><th>Vence</th><th></th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {promos.map(p => (
                                <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                                    <td className="py-2 font-mono font-black">{p.code}<div className="font-sans text-xs text-slate-400 font-normal">{p.description}</div></td>
                                    <td>{p.discount_type === 'PERCENT' ? `${Number(p.discount_value)}%` : money(p.discount_value)}</td>
                                    <td>{p.applies_to === 'ALL' ? 'Ambos' : p.applies_to === 'MONTHLY' ? 'Mensual' : 'Anual'}</td>
                                    <td>{p.uses}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                                    <td>{p.valid_until ? date(p.valid_until) : '—'}</td>
                                    <td className="text-right"><button onClick={() => togglePromo(p)} className="px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-black">{p.active ? 'Desactivar' : 'Activar'}</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div>
                )}
            </Card>

            <Card title="Claves de licencia" icon={KeyRound} action={<button onClick={() => exportCsv(keys)} disabled={!keys.length} className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-black inline-flex items-center gap-1 disabled:opacity-40"><Download className="w-3.5 h-3.5" /> CSV</button>}>
                <div className="flex gap-1 mb-3 overflow-x-auto">
                    {([['AVAILABLE', 'Disponibles'], ['REDEEMED', 'Canjeadas'], ['REVOKED', 'Revocadas'], ['ALL', 'Todas']] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setKeyFilter(k)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black ${keyFilter === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
                    ))}
                </div>
                {keys.length === 0 ? <p className="text-sm text-slate-500">Sin claves en esta vista.</p> : (
                    <div className="overflow-x-auto max-h-[480px] overflow-y-auto"><table className="w-full text-sm min-w-[640px]">
                        <thead className="sticky top-0 bg-white"><tr className="text-left text-xs text-slate-500"><th className="py-2">Clave</th><th>Meses</th><th>Estado</th><th>Nota</th><th>Canjeada por</th><th></th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {keys.map(k => (
                                <tr key={k.id}>
                                    <td className="py-2 font-mono font-black">{fmtKey(k.key)}</td>
                                    <td>{k.months}</td>
                                    <td>{k.status === 'AVAILABLE' ? 'Disponible' : k.status === 'REDEEMED' ? 'Canjeada' : 'Revocada'}</td>
                                    <td className="text-slate-500">{k.note ?? ''}</td>
                                    <td className="text-slate-500">{k.tenant?.name ? `${k.tenant.name} · ${date(k.redeemed_at)}` : '—'}</td>
                                    <td className="text-right">
                                        <button title="Copiar" aria-label="Copiar clave" onClick={() => navigator.clipboard?.writeText(fmtKey(k.key))} className="p-1.5 rounded-lg hover:bg-slate-100"><Copy className="w-4 h-4" /></button>
                                        {k.status === 'AVAILABLE' && <button title="Revocar" aria-label="Revocar clave" onClick={() => revoke(k.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"><Ban className="w-4 h-4" /></button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div>
                )}
            </Card>
        </div>
    )
}

const LEAD_STATUS: Record<string, string> = { NEW: 'Nueva', CONTACTED: 'Contactada', WON: 'Ganada', LOST: 'Perdida' }

/** Solicitudes de cotización de escuelas (la anualidad depende del número de usuarios). */
const SalesLeadsCard = () => {
    const qc = useQueryClient()
    const [salesEmail, setSalesEmail] = useState<string | null>(null)
    const { data: leads = [] } = useQuery({
        queryKey: ['god', 'leads'],
        queryFn: async () => ((await db.from('sales_leads').select('*, tenant:tenants(name)').order('created_at', { ascending: false }).limit(200)).data ?? []) as any[],
    })
    const { data: currentEmail = '' } = useQuery({
        queryKey: ['god', 'sales-email'],
        queryFn: async () => ((await db.from('system_settings').select('value').eq('key', 'sales_email').maybeSingle()).data?.value ?? '') as string,
    })
    const setStatus = async (id: number, status: string) => {
        await db.from('sales_leads').update({ status }).eq('id', id)
        qc.invalidateQueries({ queryKey: ['god', 'leads'] })
    }
    const saveEmail = async () => {
        await db.from('system_settings').upsert({ key: 'sales_email', value: (salesEmail ?? '').trim(), description: 'Correo que recibe las solicitudes de cotización de escuelas' }, { onConflict: 'key' })
        setSalesEmail(null)
        qc.invalidateQueries({ queryKey: ['god', 'sales-email'] })
    }
    const nuevas = leads.filter(l => l.status === 'NEW').length
    return (
        <Card title={`Cotizaciones de escuelas${nuevas ? ` (${nuevas} nuevas)` : ''}`} icon={Building2}>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input className={`${input} sm:flex-1`} type="email" placeholder="Correo de ventas que recibe los avisos" value={salesEmail ?? currentEmail} onChange={e => setSalesEmail(e.target.value)} />
                <button onClick={saveEmail} disabled={salesEmail === null} className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40">Guardar correo</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">Para cerrar una venta: genera una clave de 12 meses en “Claves y códigos” y envíala a la escuela; la dirección la activa en Suscripción.</p>
            {leads.length === 0 ? <p className="text-sm text-slate-500">Aún no hay solicitudes.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]">
                    <thead><tr className="text-left text-xs text-slate-500"><th className="py-2">Escuela</th><th>Contacto</th><th>Usuarios</th><th>Fecha</th><th>Estado</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {leads.map(l => (
                            <tr key={l.id}>
                                <td className="py-2 font-bold text-slate-800">{l.tenant?.name ?? '—'}{l.message && <div className="text-xs font-normal text-slate-500">{l.message}</div>}</td>
                                <td>{l.contact_name}<div className="text-xs text-slate-500">{l.email}{l.phone ? ` · ${l.phone}` : ''}</div></td>
                                <td>{l.users_count ?? '—'}</td>
                                <td>{date(l.created_at)}</td>
                                <td>
                                    <select className="px-2 py-1.5 rounded-xl border border-slate-200 text-xs font-bold" value={l.status} onChange={e => setStatus(l.id, e.target.value)}>
                                        {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            )}
        </Card>
    )
}
