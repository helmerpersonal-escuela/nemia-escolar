import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckSquare, FileDown, FileSpreadsheet, Receipt, Search, Square, Undo2, UserPlus, Users, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import { WizardField } from '../../../components/wizard/Wizard'
import { DateInput } from '../../../components/ui/DateInput'
import { buildConstanciaModel, buildPartnersModel, buildReceiptModel } from '../lib/format'
import { exportModels } from '../export'
import { isThirdGrade, money, num, partnerName, type CoopBundleCtx } from './shared'
import { Btn, Card, Empty, Kpi, inputSm } from './ui'

const db = supabase as any

export const PartnersTab = ({ bundle, onChanged }: { bundle: CoopBundleCtx; onChanged: () => void }) => {
    const { ctx, partners } = bundle
    const { showToast } = useToast()
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'NUEVOS' | 'ACTIVO' | 'DEVUELTO' | 'TODOS'>('NUEVOS')
    const [adding, setAdding] = useState(false)
    const [busy, setBusy] = useState(false)

    const fee = num(ctx.coop.membership_fee) || 5
    const current = partners.filter(p => p.academic_year_id === ctx.cycle.id)
    const active = partners.filter(p => p.status === 'ACTIVO')
    const capital = active.reduce((s, p) => s + num(p.amount), 0)
    const returned = partners.filter(p => p.status === 'DEVUELTO')

    const list = useMemo(() => {
        const base = filter === 'NUEVOS' ? current : filter === 'TODOS' ? partners : partners.filter(p => p.status === filter)
        const q = search.trim().toLowerCase()
        return q ? base.filter(p => partnerName(p).toLowerCase().includes(q) || String(p.folio).includes(q) || (p.group_label ?? '').toLowerCase().includes(q)) : base
    }, [filter, current, partners, search])

    const run = async (fn: () => Promise<void>) => {
        setBusy(true)
        try { await fn() } catch (e: any) { showToast('No se pudo generar el archivo: ' + (e?.message ?? e), 'error') } finally { setBusy(false) }
    }

    const constancia = () => {
        const byUnit = new Map<string, { name: string; count: number; amount: number }>()
        for (const p of current) {
            const grade = (p.group_label ?? '').match(/^\s*(\d)/)?.[1]
            const key = grade ? `Socios de ${grade}° grado` : 'Socios sin grupo'
            const u = byUnit.get(key) ?? { name: key, count: 0, amount: 0 }
            u.count++; u.amount += num(p.amount)
            byUnit.set(key, u)
        }
        return buildConstanciaModel(current, active.length, ctx, [...byUnit.values()])
    }

    const markReturned = async (id: string, certificates: number) => {
        const { error } = await db.from('coop_partners').update({ status: 'DEVUELTO', returned_at: new Date().toISOString().slice(0, 10), returned_amount: certificates * (num(ctx.coop.certificate_value) || 5) }).eq('id', id)
        if (error) return showToast('No se pudo actualizar: ' + error.message, 'error')
        showToast('Certificado marcado como devuelto', 'success'); onChanged()
    }
    const undo = async (id: string) => {
        const { error } = await db.from('coop_partners').update({ status: 'ACTIVO', returned_at: null, returned_amount: null }).eq('id', id)
        if (error) return showToast('No se pudo actualizar: ' + error.message, 'error')
        onChanged()
    }
    const returnAllThird = async () => {
        const ids = active.filter(p => isThirdGrade(p.group_label))
        if (!ids.length) return showToast('No hay socios activos de 3er grado.', 'info')
        if (!confirm(`¿Marcar como devueltos los certificados de ${ids.length} socio(s) de 3er grado?`)) return
        for (const p of ids) await markReturned(p.id, p.certificates)
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Socios activos" value={active.length} tone="indigo" />
                <Kpi label={`Nuevos en ${ctx.cycle.name || 'el ciclo'}`} value={current.length} />
                <Kpi label="Capital social" value={money(capital)} tone="emerald" hint={`Aportación: ${money(fee)} por socio`} />
                <Kpi label="Certificados devueltos" value={returned.length} tone="amber" />
            </div>

            <Card title="Socios" icon={Users} action={<Btn tone="primary" icon={UserPlus} onClick={() => setAdding(true)}>Registrar</Btn>}>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input className={`${inputSm} pl-9`} placeholder="Buscar por nombre, folio o grupo" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-1 overflow-x-auto">
                        {([['NUEVOS', 'Nuevos del ciclo'], ['ACTIVO', 'Activos'], ['DEVUELTO', 'Devueltos'], ['TODOS', 'Todos']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setFilter(k)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-black ${filter === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
                        ))}
                    </div>
                </div>

                {list.length === 0 ? (
                    <Empty icon={Users} title="Sin socios en esta vista" text={`Registra a los alumnos de nuevo ingreso con su aportación de ${money(fee)}. Cada registro genera su recibo digital.`} />
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {list.map(p => (
                            <li key={p.id} className="py-2.5 flex items-center gap-3">
                                <span className="w-12 shrink-0 text-xs font-black text-slate-400">#{String(p.folio).padStart(4, '0')}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-800 truncate">{partnerName(p)}</p>
                                    <p className="text-xs text-slate-500">{p.group_label || 'Sin grupo'} · {money(num(p.amount))} · {new Date(`${p.joined_at}T00:00:00`).toLocaleDateString('es-MX')}
                                        {p.status === 'DEVUELTO' && <span className="text-amber-700 font-bold"> · Devuelto {p.returned_amount != null ? money(num(p.returned_amount)) : ''}</span>}
                                        {p.status === 'BAJA' && <span className="text-rose-600 font-bold"> · Baja</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button title="Recibo digital" aria-label="Recibo digital" disabled={busy} onClick={() => run(() => exportModels([buildReceiptModel(p, ctx)], 'pdf'))} className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50"><Receipt className="w-4 h-4" /></button>
                                    {p.status === 'ACTIVO'
                                        ? <button title="Devolver certificado" aria-label="Devolver certificado" onClick={() => markReturned(p.id, p.certificates)} className="p-2 rounded-xl text-amber-600 hover:bg-amber-50"><Undo2 className="w-4 h-4" /></button>
                                        : <button title="Reactivar" aria-label="Reactivar" onClick={() => undo(p.id)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><Undo2 className="w-4 h-4 -scale-x-100" /></button>}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Documentos de socios" icon={FileDown}>
                <div className="grid sm:grid-cols-2 gap-2">
                    <Btn icon={FileDown} disabled={busy || !current.length} onClick={() => run(() => exportModels([buildPartnersModel(current, ctx)], 'pdf'))}>Relación de nuevos socios (PDF)</Btn>
                    <Btn icon={FileSpreadsheet} disabled={busy || !current.length} onClick={() => run(() => exportModels([buildPartnersModel(current, ctx)], 'xlsx'))}>Relación de nuevos socios (Excel)</Btn>
                    <Btn icon={FileDown} disabled={busy || !current.length} onClick={() => run(() => exportModels([constancia()], 'pdf'))}>Constancia de nuevos certificados</Btn>
                    <Btn icon={Receipt} disabled={busy || !current.length} onClick={() => run(() => exportModels(current.map(p => buildReceiptModel(p, ctx)), 'pdf', `Recibos_socios_${ctx.cycle.name}`))}>Todos los recibos del ciclo</Btn>
                    <Btn icon={Undo2} className="sm:col-span-2" onClick={returnAllThird}>Devolver certificados a todo 3er grado</Btn>
                </div>
            </Card>

            {adding && <AddPartners bundle={bundle} fee={fee} onClose={() => setAdding(false)} onSaved={onChanged} />}
        </div>
    )
}

const AddPartners = ({ bundle, fee, onClose, onSaved }: { bundle: CoopBundleCtx; fee: number; onClose: () => void; onSaved: () => void }) => {
    const { ctx, partners } = bundle
    const { showToast } = useToast()
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [group, setGroup] = useState('')
    const [search, setSearch] = useState('')
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [amount, setAmount] = useState<number | ''>(fee)
    const [saving, setSaving] = useState(false)
    const [receipts, setReceipts] = useState(true)

    const { data: students = [], isLoading } = useQuery({
        queryKey: ['coop', 'students', ctx.coop.tenant_id],
        queryFn: async () => {
            const [st, gr] = await Promise.all([
                db.from('students').select('id, first_name, last_name_paternal, last_name_maternal, group_id, status').eq('tenant_id', ctx.coop.tenant_id).or('status.is.null,status.not.in.(GRADUATED,INACTIVE)'),
                db.from('groups').select('id, grade, section').eq('tenant_id', ctx.coop.tenant_id).is('archived_at', null),
            ])
            const label = new Map<string, string>((gr.data ?? []).map((g: any) => [g.id, `${g.grade}° ${g.section}`]))
            return ((st.data ?? []) as any[]).map(s => ({ ...s, group_label: s.group_id ? label.get(s.group_id) ?? '' : '' }))
                .sort((a, b) => (a.group_label || '~').localeCompare(b.group_label || '~') || a.last_name_paternal.localeCompare(b.last_name_paternal))
        },
    })
    const taken = new Set(partners.map(p => p.student_id))
    const groups = [...new Set(students.map((s: any) => s.group_label).filter(Boolean))] as string[]
    const available = students.filter((s: any) => !taken.has(s.id) && (!group || s.group_label === group) &&
        (!search || `${s.last_name_paternal} ${s.last_name_maternal ?? ''} ${s.first_name}`.toLowerCase().includes(search.toLowerCase())))
    const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
    const allOn = available.length > 0 && available.every((s: any) => selected.has(s.id))

    const save = async () => {
        if (!selected.size) return
        setSaving(true)
        const rows = students.filter((s: any) => selected.has(s.id)).map((s: any) => ({
            tenant_id: ctx.coop.tenant_id, cooperative_id: ctx.coop.id, student_id: s.id, academic_year_id: ctx.cycle.id,
            group_label: s.group_label || null, amount: num(amount) || fee, certificates: 1, joined_at: date,
        }))
        const { data, error } = await db.from('coop_partners').insert(rows).select('*, student:students(first_name, last_name_paternal, last_name_maternal, group_id)')
        setSaving(false)
        if (error) return showToast('No se pudo registrar: ' + error.message, 'error')
        showToast(`${rows.length} socio(s) registrado(s)`, 'success')
        onSaved()
        if (receipts && data?.length) {
            try { await exportModels((data as any[]).sort((a, b) => a.folio - b.folio).map(p => buildReceiptModel(p, ctx)), 'pdf', `Recibos_nuevos_socios_${date}`) }
            catch { /* los recibos se pueden descargar después */ }
        }
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Registrar socios">
            <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col">
                <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Registrar nuevos socios</h3>
                        <p className="text-sm text-slate-500">Cada alumno aporta {money(fee)}. Se asigna folio y recibo digital automáticamente.</p>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 sm:p-6 space-y-3 overflow-y-auto">
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
                        <WizardField label="Fecha de aportación"><DateInput className={inputSm} value={date} onChange={e => setDate(e.target.value)} /></WizardField>
                        <WizardField label="Aportación ($)"><input className={inputSm} type="number" min="0" step="0.5" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} /></WizardField>
                        <WizardField label="Grupo">
                            <select className={inputSm} value={group} onChange={e => setGroup(e.target.value)}>
                                <option value="">Todos</option>{groups.map(g => <option key={g}>{g}</option>)}
                            </select>
                        </WizardField>
                    </div>
                    <input className={inputSm} placeholder="Buscar alumno" value={search} onChange={e => setSearch(e.target.value)} />
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <button onClick={() => setSelected(prev => { const n = new Set(prev); available.forEach((s: any) => allOn ? n.delete(s.id) : n.add(s.id)); return n })} className="inline-flex items-center gap-1.5 text-indigo-700">
                            {allOn ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />} Seleccionar {allOn ? 'ninguno' : 'todos'}
                        </button>
                        <span>{selected.size} seleccionado(s)</span>
                    </div>
                    {isLoading ? <p className="text-sm text-slate-500 py-6 text-center">Cargando alumnos…</p> : available.length === 0 ? (
                        <p className="text-sm text-slate-500 py-6 text-center">No hay alumnos pendientes de registrar{group ? ` en ${group}` : ''}.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                            {available.map((s: any) => (
                                <li key={s.id}>
                                    <button onClick={() => toggle(s.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                                        {selected.has(s.id) ? <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                                        <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 truncate">{[s.last_name_paternal, s.last_name_maternal, s.first_name].filter(Boolean).join(' ')}</span>
                                        <span className="text-xs text-slate-500 shrink-0">{s.group_label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={receipts} onChange={e => setReceipts(e.target.checked)} className="w-4 h-4 accent-indigo-600" /> Descargar los recibos al guardar
                    </label>
                </div>
                <div className="p-4 sm:p-6 border-t border-slate-100 flex items-center justify-between gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <span className="text-sm font-black text-slate-700">Total: {money(selected.size * (num(amount) || fee))}</span>
                    <Btn tone="primary" icon={UserPlus} disabled={!selected.size || saving} onClick={save}>{saving ? 'Guardando…' : `Registrar ${selected.size || ''}`}</Btn>
                </div>
            </div>
        </div>
    )
}
