import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import {
    AGREEMENT_STATUS_LABEL, sessionLabel, todayISO,
    type AgreementStatus, type CteAgreement, type CteSession, type StaffMember,
} from '../lib/cteApi'

const STATUS_CLS: Record<AgreementStatus, string> = {
    PENDIENTE: 'bg-amber-50 text-amber-700',
    EN_PROCESO: 'bg-indigo-50 text-indigo-700',
    CUMPLIDO: 'bg-emerald-50 text-emerald-700',
    NO_CUMPLIDO: 'bg-rose-50 text-rose-700',
}

interface Props {
    tenantId: string
    sessions: CteSession[]
    staff: StaffMember[]
    defaultSessionId: string | null
}

export const AgreementsPanel = ({ tenantId, sessions, staff, defaultSessionId }: Props) => {
    const { showToast } = useToast()
    const [items, setItems] = useState<CteAgreement[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'OPEN' | 'ALL'>('OPEN')
    const [form, setForm] = useState({ description: '', responsible: '', due_date: '', session_id: defaultSessionId ?? '' })
    const [edits, setEdits] = useState<Record<string, Partial<CteAgreement>>>({})

    useEffect(() => {
        let alive = true
        supabase
            .from('cte_agreements')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (!alive) return
                if (error) showToast('No se pudieron cargar los acuerdos.', 'error')
                setItems((data ?? []) as CteAgreement[])
                setLoading(false)
            })
        return () => { alive = false }
    }, [tenantId, showToast])

    const visible = useMemo(
        () => items.filter(a => filter === 'ALL' || a.status === 'PENDIENTE' || a.status === 'EN_PROCESO'),
        [items, filter],
    )

    const add = async () => {
        if (!form.description.trim()) return
        const member = staff.find(s => s.name === form.responsible)
        const { data, error } = await supabase.from('cte_agreements').insert({
            tenant_id: tenantId,
            session_id: form.session_id || null,
            description: form.description.trim(),
            responsible_profile_id: member?.profile_id ?? null,
            responsible_label: form.responsible.trim() || null,
            due_date: form.due_date || null,
        }).select().single()
        if (error) { showToast('No se pudo registrar el acuerdo.', 'error'); return }
        setItems(prev => [data as CteAgreement, ...prev])
        setForm(f => ({ ...f, description: '', responsible: '', due_date: '' }))
    }

    const saveEdit = async (a: CteAgreement) => {
        const patch = edits[a.id]
        if (!patch) return
        const { data, error } = await supabase.from('cte_agreements').update(patch).eq('id', a.id).select().single()
        if (error) { showToast('No se pudo actualizar.', 'error'); return }
        setItems(prev => prev.map(x => x.id === a.id ? data as CteAgreement : x))
        setEdits(prev => { const n = { ...prev }; delete n[a.id]; return n })
        showToast('Seguimiento guardado.', 'success')
    }

    const remove = async (a: CteAgreement) => {
        if (!window.confirm('¿Eliminar este acuerdo?')) return
        const { error } = await supabase.from('cte_agreements').delete().eq('id', a.id)
        if (error) { showToast('No se pudo eliminar.', 'error'); return }
        setItems(prev => prev.filter(x => x.id !== a.id))
    }

    const today = todayISO()

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-3">
                <h2 className="font-black text-slate-900">Nuevo acuerdo</h2>
                <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="¿Qué se acordó? (acción concreta y producto esperado)"
                    className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input list="cte-agreement-staff" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Responsable" className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                    <datalist id="cte-agreement-staff">
                        {['Dirección', 'Coordinación académica', 'Colectivo docente', ...staff.map(s => s.name)].map(n => <option key={n} value={n} />)}
                    </datalist>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" aria-label="Fecha compromiso" />
                    <select value={form.session_id} onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" aria-label="Sesión">
                        <option value="">Sin sesión</option>
                        {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
                    </select>
                    <button onClick={add} disabled={!form.description.trim()} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">
                        <Plus className="w-4 h-4" /> Agregar
                    </button>
                </div>
                <p className="text-[11px] text-slate-500">Si eliges a un docente de la lista, verá el acuerdo en su panel y podrá reportar avance.</p>
            </div>

            <div className="flex gap-2">
                {(['OPEN', 'ALL'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                        {f === 'OPEN' ? 'Abiertos' : 'Todos'}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-100">
                {loading && <p className="p-6 text-sm text-slate-500">Cargando…</p>}
                {!loading && visible.length === 0 && <p className="p-6 text-sm text-slate-500">No hay acuerdos {filter === 'OPEN' ? 'abiertos' : ''}.</p>}
                {visible.map(a => {
                    const e = edits[a.id] ?? {}
                    const status = (e.status ?? a.status) as AgreementStatus
                    const overdue = a.due_date && a.due_date < today && (status === 'PENDIENTE' || status === 'EN_PROCESO')
                    return (
                        <div key={a.id} className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{a.description}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {a.responsible_label || 'Sin responsable'}
                                        {a.due_date && <> · <span className={overdue ? 'text-rose-600 font-bold' : ''}>compromiso {a.due_date}{overdue ? ' (vencido)' : ''}</span></>}
                                        {a.session_id && <> · {sessionLabel(sessions.find(s => s.id === a.session_id) ?? { session_type: 'ORDINARIA', session_number: 0, title: 'Sesión' })}</>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <select
                                        value={status}
                                        onChange={ev => setEdits(p => ({ ...p, [a.id]: { ...p[a.id], status: ev.target.value as AgreementStatus } }))}
                                        className={`text-xs font-bold rounded-full px-2 py-1 border-0 ${STATUS_CLS[status]}`}
                                        aria-label="Estado"
                                    >
                                        {Object.entries(AGREEMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                    <button onClick={() => remove(a)} className="p-1.5 text-slate-300 hover:text-rose-500" aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={e.follow_up ?? a.follow_up ?? ''}
                                    onChange={ev => setEdits(p => ({ ...p, [a.id]: { ...p[a.id], follow_up: ev.target.value } }))}
                                    placeholder="Seguimiento / evidencia"
                                    className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs"
                                />
                                {edits[a.id] && (
                                    <button onClick={() => saveEdit(a)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold">
                                        <Save className="w-3.5 h-3.5" /> Guardar
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
