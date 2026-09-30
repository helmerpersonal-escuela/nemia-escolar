import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy, Loader2, Send, CheckCircle2, Clock, XCircle, Save, History } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useToast } from '../../../components/ui/Toast'
import { formatDateEs } from '../../../components/ui/DateInput'
import { wizardInput } from '../../../components/wizard/Wizard'
import { roleLabel } from '../../../lib/roleLabels'

type Status = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED' | 'CANCELLED'
type Req = { id: string; created_by: string; kind: string; title: string; details: string | null; status: Status; response: string | null; handled_by: string | null; created_at: string; resolved_at: string | null }

export const REQUEST_KINDS: Record<string, string> = {
    PERSONAL: 'Alta, baja o cambio de personal',
    ALUMNOS: 'Alumnos o tutores (inscripción, datos, teléfonos)',
    GRUPOS: 'Grupos, materias u horario',
    FAMILIAS: 'Códigos para familias',
    ESCUELA: 'Datos de la escuela, ciclo o jornada',
    IMPORTAR: 'Cargar archivos de la escuela',
    OTRO: 'Otro',
}
const STATUS: Record<Status, { label: string; cls: string; icon: any }> = {
    PENDING: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-800', icon: Clock },
    IN_PROGRESS: { label: 'En proceso', cls: 'bg-indigo-50 text-indigo-800', icon: Loader2 },
    DONE: { label: 'Atendida', cls: 'bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
    REJECTED: { label: 'No procede', cls: 'bg-red-50 text-red-800', icon: XCircle },
    CANCELLED: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-600', icon: XCircle },
}
const MANAGERS = ['DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN']
const OPEN: Status[] = ['PENDING', 'IN_PROGRESS']

/**
 * Solicitudes al administrador técnico: cualquier persona del personal pide un cambio
 * (dar de alta a alguien, corregir un teléfono, mover a un alumno de grupo…) y el técnico lo atiende.
 */
export const SupportRequestsPage = () => {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    const role = String((tenant as any)?.role || '').toUpperCase()
    const canManage = MANAGERS.includes(role)
    const { showToast } = useToast()
    const [rows, setRows] = useState<Req[]>([])
    const [people, setPeople] = useState<Record<string, { name: string; role: string }>>({})
    const [me, setMe] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'open' | 'closed'>('open')
    const [form, setForm] = useState({ kind: 'PERSONAL', title: '', details: '' })
    const [sending, setSending] = useState(false)
    const [edit, setEdit] = useState<Record<string, { status: Status; response: string }>>({})
    const [busy, setBusy] = useState<string | null>(null)

    const load = async () => {
        if (!tenantId) return
        setLoading(true)
        const [{ data: r }, { data: staff }, { data: { user } }] = await Promise.all([
            supabase.from('support_requests').select('id, created_by, kind, title, details, status, response, handled_by, created_at, resolved_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(300),
            supabase.rpc('school_staff'),
            supabase.auth.getUser(),
        ])
        setRows((r as Req[]) ?? [])
        setPeople(Object.fromEntries(((staff as any[]) ?? []).map(m => [m.profile_id, { name: [m.first_name, m.last_name_paternal].filter(Boolean).join(' ') || m.email, role: m.role }])))
        setMe(user?.id ?? null)
        setLoading(false)
    }
    useEffect(() => { load() }, [tenantId])

    const shown = useMemo(() => rows.filter(r => (tab === 'open') === OPEN.includes(r.status)), [rows, tab])
    const openCount = rows.filter(r => OPEN.includes(r.status)).length

    const send = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tenantId || !form.title.trim()) { showToast('Escribe qué necesitas.', 'error'); return }
        setSending(true)
        const { error } = await supabase.from('support_requests').insert({ tenant_id: tenantId, kind: form.kind, title: form.title.trim(), details: form.details.trim() || null })
        setSending(false)
        if (error) { showToast('No se pudo enviar: ' + error.message, 'error'); return }
        showToast('Solicitud enviada al administrador técnico.', 'success')
        setForm({ kind: form.kind, title: '', details: '' })
        setTab('open'); load()
    }

    const save = async (r: Req, next?: Partial<{ status: Status; response: string }>) => {
        const d: { status: Status; response: string } = { ...(edit[r.id] ?? { status: r.status, response: r.response ?? '' }), ...next }
        setBusy(r.id)
        const closed = ['DONE', 'REJECTED', 'CANCELLED'].includes(d.status)
        const { error } = await supabase.from('support_requests').update({
            status: d.status, response: d.response.trim() || null, handled_by: canManage ? me : r.handled_by,
            resolved_at: closed ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
        }).eq('id', r.id)
        setBusy(null)
        if (error) { showToast('No se pudo guardar: ' + error.message, 'error'); return }
        setEdit(x => { const { [r.id]: _, ...rest } = x; return rest })
        showToast('Solicitud actualizada', 'success')
        load()
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 flex items-start gap-3">
                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><LifeBuoy className="w-6 h-6" /></div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Solicitudes al técnico</h1>
                    <p className="text-slate-600 text-sm">Pide aquí altas de personal, cambios de grupo, correcciones de datos o códigos para familias. El administrador técnico lo atiende y te responde.</p>
                    {canManage && <Link to="/bitacora" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-indigo-700 underline"><History className="w-4 h-4" /> Ver la bitácora de cambios</Link>}
                </div>
            </div>

            <form onSubmit={send} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 space-y-3">
                <h2 className="font-black text-slate-900">Nueva solicitud</h2>
                <select aria-label="Tipo de solicitud" className={wizardInput} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                    {Object.entries(REQUEST_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input aria-label="Qué necesitas" className={wizardInput} maxLength={140} placeholder="Ej. Dar de alta a la maestra de Inglés de 2.º" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <textarea aria-label="Detalles" className={`${wizardInput} min-h-[90px]`} placeholder="Detalles (opcional). No escribas contraseñas." value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} />
                <div className="flex justify-end">
                    <button type="submit" disabled={sending} className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 disabled:opacity-60">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
                    </button>
                </div>
            </form>

            <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100">
                <div className="flex gap-2 mb-4" role="tablist">
                    <button role="tab" aria-selected={tab === 'open'} onClick={() => setTab('open')} className={`min-h-[44px] px-4 rounded-2xl text-sm font-bold ${tab === 'open' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Abiertas ({openCount})</button>
                    <button role="tab" aria-selected={tab === 'closed'} onClick={() => setTab('closed')} className={`min-h-[44px] px-4 rounded-2xl text-sm font-bold ${tab === 'closed' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Terminadas</button>
                </div>
                {loading ? <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p> : !shown.length ? (
                    <p className="text-sm text-slate-500">{tab === 'open' ? 'No hay solicitudes abiertas.' : 'Aún no hay solicitudes terminadas.'}</p>
                ) : (
                    <ul className="space-y-3">
                        {shown.map(r => {
                            const st = STATUS[r.status]
                            const who = people[r.created_by]
                            const d = edit[r.id] ?? { status: r.status, response: r.response ?? '' }
                            const mine = r.created_by === me
                            return (
                                <li key={r.id} className="rounded-2xl border border-slate-100 p-4 space-y-2">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-black text-slate-900">{r.title}</p>
                                            <p className="text-xs text-slate-500">{REQUEST_KINDS[r.kind] ?? r.kind} · {who ? `${who.name} (${roleLabel(who.role)})` : 'Personal'} · {formatDateEs(r.created_at.slice(0, 10))}</p>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${st.cls}`}><st.icon className="w-3.5 h-3.5" /> {st.label}</span>
                                    </div>
                                    {r.details && <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.details}</p>}
                                    {r.response && !canManage && <p className="text-sm bg-slate-50 rounded-xl p-3"><b>Respuesta:</b> {r.response}</p>}
                                    {canManage && (
                                        <div className="flex flex-col md:flex-row gap-2 pt-1">
                                            <select aria-label="Estado" className={`${wizardInput} !py-2 md:w-44`} value={d.status} onChange={e => setEdit(x => ({ ...x, [r.id]: { ...d, status: e.target.value as Status } }))}>
                                                {(Object.keys(STATUS) as Status[]).map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
                                            </select>
                                            <input aria-label="Respuesta" className={`${wizardInput} !py-2 flex-1`} placeholder="Respuesta para quien la pidió" value={d.response} onChange={e => setEdit(x => ({ ...x, [r.id]: { ...d, response: e.target.value } }))} />
                                            <button type="button" disabled={busy === r.id} onClick={() => save(r)} className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 disabled:opacity-60">
                                                {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                                            </button>
                                        </div>
                                    )}
                                    {!canManage && mine && r.status === 'PENDING' && (
                                        <button type="button" disabled={busy === r.id} onClick={() => save(r, { status: 'CANCELLED' })} className="text-xs font-bold text-red-700 underline">Cancelar solicitud</button>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>
        </div>
    )
}
