import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Send, CheckCircle2, ExternalLink, CalendarPlus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import {
    CTE_PORTAL_URL, publishAgenda, sessionLabel,
    type AgendaItem, type CteSession, type StaffMember,
} from '../lib/cteApi'

const STATUS_BADGE: Record<CteSession['status'], { label: string; cls: string }> = {
    PLANNED: { label: 'Por preparar', cls: 'bg-amber-50 text-amber-700' },
    AGENDA_READY: { label: 'Agenda publicada', cls: 'bg-indigo-50 text-indigo-700' },
    DONE: { label: 'Realizada', cls: 'bg-emerald-50 text-emerald-700' },
}

interface Props {
    sessions: CteSession[]
    loading: boolean
    selectedId: string | null
    onSelect: (id: string) => void
    onChange: (s: CteSession) => void
    onCreated: () => void
    tenantId: string
    schoolYear: string
    staff: StaffMember[]
}

export const SessionsPanel = ({ sessions, loading, selectedId, onSelect, onChange, onCreated, tenantId, schoolYear, staff }: Props) => {
    const { showToast } = useToast()
    const selected = sessions.find(s => s.id === selectedId) ?? null
    const [draft, setDraft] = useState<CteSession | null>(selected)
    const [saving, setSaving] = useState(false)
    const [newDate, setNewDate] = useState('')

    useEffect(() => { setDraft(selected) }, [selected])

    if (loading && !sessions.length) {
        return <div className="p-10 text-center text-slate-500 text-sm">Cargando sesiones…</div>
    }

    const patch = (p: Partial<CteSession>) => setDraft(d => d ? { ...d, ...p } : d)
    const setItem = (id: string, p: Partial<AgendaItem>) =>
        patch({ agenda: (draft?.agenda ?? []).map(i => i.id === id ? { ...i, ...p } : i) })

    const save = async (extra: Partial<CteSession> = {}) => {
        if (!draft) return
        setSaving(true)
        try {
            const values = {
                title: draft.title, date: draft.date, purpose: draft.purpose, minutes: draft.minutes,
                agenda: draft.agenda, status: draft.status, ...extra,
            }
            const { data, error } = await supabase.from('cte_sessions').update(values).eq('id', draft.id).select().single()
            if (error) throw error
            onChange(data as CteSession)
            showToast('Sesión guardada.', 'success')
        } catch (e) {
            console.error(e)
            showToast('No se pudo guardar la sesión.', 'error')
        } finally {
            setSaving(false)
        }
    }

    const publish = async () => {
        if (!draft) return
        setSaving(true)
        try {
            await supabase.from('cte_sessions').update({ purpose: draft.purpose, minutes: draft.minutes, title: draft.title }).eq('id', draft.id)
            const visible = await publishAgenda(draft, draft.agenda)
            const updated = { ...draft, status: draft.status === 'DONE' ? 'DONE' : 'AGENDA_READY' } as CteSession
            onChange(updated)
            showToast(visible
                ? 'Agenda publicada: los docentes ya la ven en su panel.'
                : 'Agenda guardada. Para mostrarla a los docentes, captura primero los datos de la escuela en Ajustes.', visible ? 'success' : 'warning', 6000)
        } catch (e) {
            console.error(e)
            showToast('No se pudo publicar la agenda.', 'error')
        } finally {
            setSaving(false)
        }
    }

    const addExtraordinary = async () => {
        if (!newDate) return
        const number = Math.max(0, ...sessions.filter(s => s.session_type === 'EXTRAORDINARIA').map(s => s.session_number)) + 1
        const { error } = await supabase.from('cte_sessions').insert({
            tenant_id: tenantId, school_year: schoolYear, session_type: 'EXTRAORDINARIA',
            session_number: number, date: newDate, title: `Sesión extraordinaria ${number}`,
        })
        if (error) { showToast('No se pudo crear la sesión.', 'error'); return }
        setNewDate('')
        onCreated()
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl border border-slate-100 p-4 space-y-2 h-fit">
                {sessions.length === 0 && (
                    <p className="text-sm text-slate-500 p-4">No hay calendario oficial cargado para este ciclo. Puedes agregar sesiones manualmente.</p>
                )}
                {sessions.map(s => (
                    <button
                        key={s.id}
                        onClick={() => onSelect(s.id)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all ${s.id === selectedId ? 'border-indigo-300 bg-indigo-50/60' : 'border-transparent hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-800">{sessionLabel(s)}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[s.status].cls}`}>{STATUS_BADGE[s.status].label}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {new Date(s.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </button>
                ))}
                <div className="pt-3 border-t border-slate-100 flex gap-2">
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-1 border border-slate-200 rounded-xl px-2 py-1.5 text-xs" aria-label="Fecha de sesión extraordinaria" />
                    <button onClick={addExtraordinary} disabled={!newDate} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-40">
                        <CalendarPlus className="w-3.5 h-3.5" /> Extraordinaria
                    </button>
                </div>
            </div>

            {draft ? (
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 space-y-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                        <input
                            value={draft.title ?? ''}
                            onChange={e => patch({ title: e.target.value })}
                            className="text-lg font-black text-slate-900 bg-transparent outline-none border-b border-transparent focus:border-indigo-200"
                            aria-label="Título de la sesión"
                        />
                        <div className="flex items-center gap-2">
                            <input type="date" value={draft.date} onChange={e => patch({ date: e.target.value })} className="border border-slate-200 rounded-xl px-2 py-1.5 text-sm" aria-label="Fecha" />
                            <a href={draft.official_url || CTE_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-indigo-600">
                                <ExternalLink className="w-3.5 h-3.5" /> Guía SEP
                            </a>
                        </div>
                    </div>

                    <label className="block">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Propósito de la sesión</span>
                        <textarea
                            value={draft.purpose ?? ''}
                            onChange={e => patch({ purpose: e.target.value })}
                            rows={2}
                            className="mt-1 w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm"
                            placeholder="Copia el propósito de la guía oficial o genera una propuesta con IA."
                        />
                    </label>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Orden del día</span>
                            <button
                                onClick={() => patch({ agenda: [...(draft.agenda ?? []), { id: crypto.randomUUID(), time: '', topic: '', responsible: '', status: 'pending' }] })}
                                className="flex items-center gap-1 text-xs font-bold text-indigo-600"
                            >
                                <Plus className="w-3.5 h-3.5" /> Agregar punto
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(draft.agenda ?? []).length === 0 && <p className="text-sm text-slate-500">Sin puntos en la agenda.</p>}
                            {(draft.agenda ?? []).map(item => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
                                    <input value={item.time} onChange={e => setItem(item.id, { time: e.target.value })} placeholder="08:00" className="col-span-2 border border-slate-200 rounded-xl px-2 py-1.5 text-sm" aria-label="Hora" />
                                    <div className="col-span-6">
                                        <input value={item.topic} onChange={e => setItem(item.id, { topic: e.target.value })} placeholder="Tema o actividad" className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm" aria-label="Tema" />
                                        {item.notes && <p className="text-[11px] text-slate-500 mt-1 px-1">{item.notes}</p>}
                                    </div>
                                    <input
                                        list="cte-staff"
                                        value={item.responsible}
                                        onChange={e => setItem(item.id, { responsible: e.target.value })}
                                        placeholder="Responsable"
                                        className="col-span-3 border border-slate-200 rounded-xl px-2 py-1.5 text-sm"
                                        aria-label="Responsable"
                                    />
                                    <button onClick={() => patch({ agenda: draft.agenda.filter(i => i.id !== item.id) })} className="col-span-1 p-2 text-slate-500 hover:text-rose-500" aria-label="Quitar punto">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <datalist id="cte-staff">
                                {['Dirección', 'Coordinación académica', 'Colectivo docente', ...staff.map(s => s.name)].map(n => <option key={n} value={n} />)}
                            </datalist>
                        </div>
                    </div>

                    <label className="block">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Acta / minuta (después de la sesión)</span>
                        <textarea
                            value={draft.minutes ?? ''}
                            onChange={e => patch({ minutes: e.target.value })}
                            rows={5}
                            className="mt-1 w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm"
                            placeholder="Principales reflexiones, decisiones y productos. La IA la usará para proponer la siguiente sesión."
                        />
                    </label>

                    <div className="flex flex-wrap gap-2 justify-end">
                        <button onClick={() => save()} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700">
                            <Save className="w-4 h-4" /> Guardar
                        </button>
                        <button onClick={publish} disabled={saving || !draft.agenda?.length} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">
                            <Send className="w-4 h-4" /> Publicar agenda a docentes
                        </button>
                        {draft.status !== 'DONE' && (
                            <button onClick={() => save({ status: 'DONE' })} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold">
                                <CheckCircle2 className="w-4 h-4" /> Marcar como realizada
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="lg:col-span-2 p-10 text-center text-slate-500 text-sm bg-white rounded-3xl border border-slate-100">Selecciona una sesión.</div>
            )}
        </div>
    )
}
