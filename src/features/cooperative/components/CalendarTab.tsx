import { useState } from 'react'
import { CalendarClock, Plus, Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import { WizardAlert, WizardField } from '../../../components/wizard/Wizard'
import { DateInput, formatDateEs } from '../../../components/ui/DateInput'
import { DOC_TYPES, docShort } from '../lib/types'
import { deadlineStates, LEVEL_STYLE, levelText, suggestedDeadlines } from '../lib/deadlines'
import type { CoopBundleCtx } from './shared'
import { Btn, Card, Empty, inputSm } from './ui'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

const db = supabase as any

export const CalendarTab = ({ bundle, isReviewer, onChanged }: { bundle: CoopBundleCtx; isReviewer: boolean; onChanged: () => void }) => {
    const { ctx, deadlines, documents } = bundle
    const { showToast } = useToast()
    const [form, setForm] = useState({ doc_type: 'PLAN_ANUAL', due_date: '', circular_ref: '', notes: '' })
    const [saving, setSaving] = useState(false)
    const states = deadlineStates(deadlines, documents, isReviewer ? undefined : ctx.teacher.id)

    const add = async (rows: { doc_type: string; due_date: string; circular_ref?: string | null; notes?: string | null }[]) => {
        setSaving(true)
        const { error } = await db.from('coop_deadlines').insert(rows.map(r => ({ ...r, tenant_id: ctx.coop.tenant_id, academic_year_id: ctx.cycle.id })))
        setSaving(false)
        if (error) { showToast('No se pudo guardar: ' + error.message, 'error'); return false }
        onChanged(); return true
    }
    const submit = async () => {
        if (!form.due_date) return showToast('Indica la fecha límite.', 'warning')
        if (await add([{ ...form, circular_ref: form.circular_ref || null, notes: form.notes || null }])) {
            showToast('Fecha límite agregada', 'success')
            setForm(f => ({ ...f, due_date: '', notes: '' }))
        }
    }
    const loadSuggested = async () => {
        const existing = new Set(deadlines.map(d => d.doc_type))
        const rows = suggestedDeadlines(ctx.cycle.start ?? undefined).filter(r => !existing.has(r.doc_type)).map(r => ({ ...r, notes: `${r.notes} (fecha sugerida: ajústala a la circular)`, circular_ref: null }))
        if (!rows.length) return showToast('Ya hay fechas para todos los formatos.', 'info')
        if (await add(rows)) showToast(`${rows.length} fecha(s) sugerida(s) agregada(s)`, 'success')
    }
    const remove = async (id: string) => {
        if (!(await askConfirm('¿Eliminar esta fecha límite?'))) return
        const { error } = await db.from('coop_deadlines').delete().eq('id', id)
        if (error) return showToast('No se pudo eliminar: ' + error.message, 'error')
        onChanged()
    }

    return (
        <div className="space-y-4">
            <WizardAlert tone="info">
                Durante el primer mes del ciclo llega la circular del Área de Producción con las fechas de entrega. Captúralas aquí: el sistema te avisará en el inicio cuando se acerquen.
            </WizardAlert>

            <Card title="Fechas límite del ciclo" icon={CalendarClock} action={<Btn tone="ghost" icon={Sparkles} onClick={loadSuggested} disabled={saving} className="text-xs px-3">Sugeridas</Btn>}>
                {states.length === 0 ? (
                    <Empty icon={CalendarClock} title="Sin fechas registradas" text="Agrega las fechas de la circular o carga las fechas sugeridas para empezar." />
                ) : (
                    <ul className="space-y-2">
                        {states.map(s => (
                            <li key={s.deadline.id} className={`rounded-2xl border p-3 flex items-start gap-3 ${LEVEL_STYLE[s.level]}`}>
                                <div className="w-14 shrink-0 text-center">
                                    <div className="text-lg font-black leading-none">{new Date(`${s.deadline.due_date}T00:00:00`).getDate()}</div>
                                    <div className="text-[11px] font-black uppercase">{new Date(`${s.deadline.due_date}T00:00:00`).toLocaleDateString('es-MX', { month: 'short' })}</div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-900">{DOC_TYPES.some(d => d.type === s.deadline.doc_type) ? docShort(s.deadline.doc_type) : s.deadline.doc_type}</p>
                                    <p className="text-xs">{formatDateEs(s.deadline.due_date)} · <b>{levelText(s)}</b></p>
                                    {(s.deadline.circular_ref || s.deadline.notes) && <p className="text-xs text-slate-500 mt-0.5">{[s.deadline.circular_ref && `Circular ${s.deadline.circular_ref}`, s.deadline.notes].filter(Boolean).join(' · ')}</p>}
                                </div>
                                <button aria-label="Eliminar fecha" onClick={() => remove(s.deadline.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white"><Trash2 className="w-4 h-4" /></button>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Agregar fecha de la circular" icon={Plus}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <WizardField label="Formato">
                        <select className={inputSm} value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })}>
                            {DOC_TYPES.map(d => <option key={d.type} value={d.type}>{d.label}</option>)}
                            <option value="OTRO">Otra entrega (inventario, actas…)</option>
                        </select>
                    </WizardField>
                    <WizardField label="Fecha límite" required><DateInput className={inputSm} value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></WizardField>
                    <WizardField label="Circular (número o fecha)"><input className={inputSm} value={form.circular_ref} onChange={e => setForm({ ...form, circular_ref: e.target.value })} placeholder="Ej. 045/2026" /></WizardField>
                    <WizardField label="Nota"><input className={inputSm} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ej. Entregar en la Subjefatura con 2 copias" /></WizardField>
                </div>
                <div className="flex justify-end mt-3"><Btn tone="primary" icon={Plus} onClick={submit} disabled={saving}>Agregar</Btn></div>
            </Card>
        </div>
    )
}
