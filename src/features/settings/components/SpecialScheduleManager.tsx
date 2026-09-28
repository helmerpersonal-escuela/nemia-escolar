import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Scissors, Ban, CalendarOff, Trash2, Pencil, Plus, Wand2, Loader2, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { todayISO } from '../../../lib/dates'
import { DateInput, formatDateEs } from '../../../components/ui/DateInput'
import { askConfirm } from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { WizardField, wizardInput, wizardChoice, Radio } from '../../../components/wizard/Wizard'
import { SettingsCard, SettingsActionButton } from './SettingsUI'
import {
    buildSlots, proposeDuration, toMin, MODE_LABEL,
    type SpecialDay, type SpecialMode, type StandardDay, type TimeRange, type BreakDef,
} from '../../../lib/specialDays'

type Form = {
    id?: string
    name: string
    multi: boolean
    target_date: string
    end_date: string
    mode: SpecialMode
    start_time: string
    end_time: string
    module_duration: number
    breaksMode: 'standard' | 'none' | 'custom'
    breaks: BreakDef[]
    blocked_ranges: TimeRange[]
    note: string
}

const MODES: { value: SpecialMode; icon: any; title: string; hint: string }[] = [
    { value: 'SHORTENED', icon: Scissors, title: 'Clases más cortas', hint: 'Se dan todas las clases, pero duran menos (entrada o salida distinta).' },
    { value: 'BLOCKED', icon: Ban, title: 'Suspender algunas horas', hint: 'Por un evento a cierta hora (honores, festival, junta). Las demás clases siguen igual.' },
    { value: 'NO_CLASSES', icon: CalendarOff, title: 'Sin clases', hint: 'No hay clases en todo el día (CTE, suspensión, día festivo).' },
]

const emptyForm = (std: StandardDay | null): Form => ({
    name: '',
    multi: false,
    target_date: todayISO(),
    end_date: todayISO(),
    mode: 'SHORTENED',
    start_time: std?.start_time ?? '07:00',
    end_time: '12:00',
    module_duration: std ? Math.max(20, Math.round(std.module_duration * 0.7)) : 35,
    breaksMode: 'standard',
    breaks: [],
    blocked_ranges: [{ start: '07:00', end: '08:00', label: '' }],
    note: '',
})

/** Días con horario especial: un día o varios, con clases más cortas, horas suspendidas o sin clases. */
export const SpecialScheduleManager = ({ readOnly = false }: { readOnly?: boolean }) => {
    const { data: tenant } = useTenant()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [items, setItems] = useState<SpecialDay[]>([])
    const [standard, setStandard] = useState<StandardDay | null>(null)
    const [form, setForm] = useState<Form | null>(null)
    const [showPast, setShowPast] = useState(false)
    const set = (p: Partial<Form>) => setForm(f => (f ? { ...f, ...p } : f))

    const load = async () => {
        if (!tenant?.id) return
        const [{ data: list }, { data: std }] = await Promise.all([
            supabase.from('special_schedule_structure').select('*').eq('tenant_id', tenant.id).order('target_date', { ascending: true }),
            supabase.from('schedule_settings').select('start_time, end_time, module_duration, breaks').eq('tenant_id', tenant.id).maybeSingle(),
        ])
        setItems(((list || []) as any[]).map(r => ({ ...r, start_time: r.start_time?.slice(0, 5) ?? null, end_time: r.end_time?.slice(0, 5) ?? null, end_date: r.end_date || r.target_date })))
        setStandard(std ? { start_time: std.start_time.slice(0, 5), end_time: std.end_time.slice(0, 5), module_duration: std.module_duration, breaks: (std.breaks as any) || [] } : null)
        setLoading(false)
    }
    useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenant?.id])

    const effectiveBreaks = (f: Form): BreakDef[] =>
        f.breaksMode === 'none' ? [] : f.breaksMode === 'standard' ? (standard?.breaks || []) : f.breaks

    // Vista previa: cómo queda cada clase del día normal
    const preview = useMemo(() => {
        if (!form || !standard) return null
        const std = buildSlots(standard.start_time, standard.end_time, standard.module_duration, standard.breaks || [])
        if (form.mode === 'NO_CLASSES') return std.map((s, i) => ({ n: i + 1, before: s, after: null as TimeRange | null }))
        if (form.mode === 'SHORTENED') {
            const nw = buildSlots(form.start_time, form.end_time, form.module_duration, effectiveBreaks(form))
            return std.map((s, i) => ({ n: i + 1, before: s, after: nw[i] ?? null }))
        }
        return std.map((s, i) => {
            let a = toMin(s.start), b = toMin(s.end)
            for (const r of form.blocked_ranges) {
                const rs = toMin(r.start), re = toMin(r.end)
                if (a < re && b > rs) { if (rs <= a && re >= b) { a = b; break } if (rs <= a) a = re; else b = rs }
            }
            const left = b - a
            return { n: i + 1, before: s, after: left >= 15 ? { start: `${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`, end: `${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}` } : null }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, standard])

    const propose = () => {
        if (!form || !standard) return
        const d = proposeDuration(standard, form.start_time, form.end_time, effectiveBreaks(form))
        if (!d || d < 10) { showToast('Con ese horario no caben todas las clases. Amplía la hora de salida.', 'error'); return }
        set({ module_duration: d })
        showToast(`Cada clase quedará de ${d} minutos para que quepan todas.`, 'success')
    }

    const validate = (f: Form): string | null => {
        if (!f.name.trim()) return 'Escribe el nombre del evento (por ejemplo, Festival de primavera).'
        if (!f.target_date) return 'Elige la fecha.'
        const end = f.multi ? f.end_date : f.target_date
        if (end < f.target_date) return 'La fecha final debe ser igual o posterior a la inicial.'
        if (f.mode === 'SHORTENED') {
            if (toMin(f.end_time) <= toMin(f.start_time)) return 'La hora de salida debe ser después de la de entrada.'
            if (!f.module_duration || f.module_duration < 10) return 'Cada clase debe durar al menos 10 minutos.'
        }
        if (f.mode === 'BLOCKED') {
            if (!f.blocked_ranges.length) return 'Agrega al menos un horario a suspender.'
            if (f.blocked_ranges.some(r => toMin(r.end) <= toMin(r.start))) return 'En cada horario suspendido, la hora final debe ser después de la inicial.'
        }
        const clash = items.find(it => it.id !== f.id && it.target_date <= end && it.end_date >= f.target_date)
        if (clash) return `Ya hay un día especial en esas fechas: “${clash.name}” (${rangeLabel(clash)}). Edítalo o elige otras fechas.`
        return null
    }

    const save = async () => {
        if (!form || !tenant?.id) return
        const err = validate(form)
        if (err) { showToast(err, 'error'); return }
        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        const row: any = {
            tenant_id: tenant.id,
            name: form.name.trim(),
            target_date: form.target_date,
            end_date: form.multi ? form.end_date : form.target_date,
            mode: form.mode,
            start_time: form.mode === 'SHORTENED' ? form.start_time : null,
            end_time: form.mode === 'SHORTENED' ? form.end_time : null,
            module_duration: form.mode === 'SHORTENED' ? form.module_duration : null,
            breaks: form.mode === 'SHORTENED' ? effectiveBreaks(form) : [],
            blocked_ranges: form.mode === 'BLOCKED' ? form.blocked_ranges.map(r => ({ start: r.start, end: r.end, label: r.label?.trim() || undefined })) : [],
            note: form.note.trim() || null,
            created_by: user?.id ?? null,
        }
        const { error } = form.id
            ? await supabase.from('special_schedule_structure').update(row).eq('id', form.id)
            : await supabase.from('special_schedule_structure').insert(row)
        setSaving(false)
        if (error) { showToast('No se pudo guardar: ' + error.message, 'error'); return }
        showToast(form.id ? 'Día especial actualizado' : 'Día especial guardado. Los horarios de ese día ya se ajustan solos.', 'success')
        setForm(null)
        load()
    }

    const edit = (it: SpecialDay) => {
        const stdBreaks = JSON.stringify(standard?.breaks || [])
        setForm({
            id: it.id, name: it.name, multi: it.end_date !== it.target_date, target_date: it.target_date, end_date: it.end_date,
            mode: it.mode, start_time: it.start_time || standard?.start_time || '07:00', end_time: it.end_time || '12:00',
            module_duration: it.module_duration || 35,
            breaksMode: !it.breaks?.length ? (it.mode === 'SHORTENED' ? 'none' : 'standard') : JSON.stringify(it.breaks) === stdBreaks ? 'standard' : 'custom',
            breaks: it.breaks || [], blocked_ranges: it.blocked_ranges?.length ? it.blocked_ranges : [{ start: '07:00', end: '08:00', label: '' }],
            note: it.note || '',
        })
    }

    const remove = async (it: SpecialDay) => {
        if (!(await askConfirm(`¿Eliminar “${it.name}”? Ese día volverá al horario normal.`))) return
        const { error } = await supabase.from('special_schedule_structure').delete().eq('id', it.id)
        if (error) showToast('No se pudo eliminar: ' + error.message, 'error')
        load()
    }

    const today = todayISO()
    const upcoming = items.filter(i => i.end_date >= today)
    const past = items.filter(i => i.end_date < today).reverse()

    if (loading) return <SettingsCard icon={CalendarClock} title="Días con horario especial"><p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p></SettingsCard>

    return (
        <SettingsCard icon={CalendarClock} title="Días con horario especial"
            hint="Para un día o varios: acorta las clases, suspende algunas horas o marca que no hay clases. El horario de cada docente se ajusta solo esos días."
            action={!readOnly && !form ? <SettingsActionButton onClick={() => setForm(emptyForm(standard))}>Agregar día especial</SettingsActionButton> : undefined}>

            {!standard && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                    Primero guarda la jornada normal (arriba). La usamos para saber qué clase corresponde a cada horario.
                </p>
            )}

            {form && (
                <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-4 sm:p-5 space-y-5">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-black text-slate-900">{form.id ? 'Editar día especial' : 'Nuevo día especial'}</p>
                        <button type="button" onClick={() => setForm(null)} aria-label="Cerrar sin guardar" className="p-2 rounded-xl text-slate-500 hover:bg-white"><X className="w-5 h-5" /></button>
                    </div>

                    {/* 1. Qué y cuándo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <WizardField label="Nombre del evento" required className="sm:col-span-2">
                            <input className={wizardInput} value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Ej. Festival de primavera, Honores, Semana de exámenes" />
                        </WizardField>
                        <div className="sm:col-span-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Duración">
                            <button type="button" role="radio" aria-checked={!form.multi} onClick={() => set({ multi: false })} className={wizardChoice(!form.multi)}><Radio checked={!form.multi} /> Un solo día</button>
                            <button type="button" role="radio" aria-checked={form.multi} onClick={() => set({ multi: true, end_date: form.end_date < form.target_date ? form.target_date : form.end_date })} className={wizardChoice(form.multi)}><Radio checked={form.multi} /> Varios días seguidos</button>
                        </div>
                        <WizardField label={form.multi ? 'Del día' : 'Fecha'} required>
                            <DateInput className={wizardInput} value={form.target_date} onChange={e => set({ target_date: e.target.value, end_date: form.end_date < e.target.value ? e.target.value : form.end_date })} />
                        </WizardField>
                        {form.multi && (
                            <WizardField label="Al día" required hint="Incluye los dos días. Se aplica de lunes a viernes en ese periodo.">
                                <DateInput className={wizardInput} value={form.end_date} min={form.target_date} onChange={e => set({ end_date: e.target.value })} />
                            </WizardField>
                        )}
                    </div>

                    {/* 2. Qué pasa con las clases */}
                    <div>
                        <p className="text-sm font-bold text-slate-700 mb-2">¿Qué pasa con las clases?</p>
                        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-2" role="radiogroup" aria-label="Qué pasa con las clases">
                            {MODES.map(m => {
                                const Icon = m.icon, on = form.mode === m.value
                                return (
                                    <button key={m.value} type="button" role="radio" aria-checked={on} onClick={() => set({ mode: m.value })}
                                        className={`${wizardChoice(on)} !items-start flex-col !gap-1`}>
                                        <span className="flex items-center gap-2"><Icon className="w-4 h-4" /> {m.title}</span>
                                        <span className="text-xs font-medium text-slate-500">{m.hint}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {form.mode === 'SHORTENED' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                                <WizardField label="Hora de entrada"><input type="time" className={wizardInput} value={form.start_time} onChange={e => set({ start_time: e.target.value })} /></WizardField>
                                <WizardField label="Hora de salida"><input type="time" className={wizardInput} value={form.end_time} onChange={e => set({ end_time: e.target.value })} /></WizardField>
                                <WizardField label="Minutos por clase">
                                    <input type="number" min={10} max={120} inputMode="numeric" className={wizardInput} value={form.module_duration} onChange={e => set({ module_duration: parseInt(e.target.value) || 0 })} />
                                </WizardField>
                            </div>
                            {standard && (
                                <SettingsActionButton icon={Wand2} onClick={propose}>Calcular para que quepan todas las clases</SettingsActionButton>
                            )}
                            <div>
                                <p className="text-sm font-bold text-slate-700 mb-2">Recesos ese día</p>
                                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Recesos ese día">
                                    {([['standard', 'Los de siempre'], ['none', 'Sin receso'], ['custom', 'Otros horarios']] as const).map(([v, l]) => (
                                        <button key={v} type="button" role="radio" aria-checked={form.breaksMode === v}
                                            onClick={() => set({ breaksMode: v, breaks: v === 'custom' && !form.breaks.length ? [{ name: 'Receso', start_time: '09:30', end_time: '09:50' }] : form.breaks })}
                                            className={wizardChoice(form.breaksMode === v)}><Radio checked={form.breaksMode === v} /> {l}</button>
                                    ))}
                                </div>
                                {form.breaksMode === 'custom' && (
                                    <div className="mt-3 space-y-2">
                                        {form.breaks.map((b, i) => (
                                            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                                <WizardField label="De"><input type="time" className={wizardInput} value={b.start_time} onChange={e => set({ breaks: form.breaks.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x) })} /></WizardField>
                                                <WizardField label="A"><input type="time" className={wizardInput} value={b.end_time} onChange={e => set({ breaks: form.breaks.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x) })} /></WizardField>
                                                <button type="button" aria-label="Quitar receso" onClick={() => set({ breaks: form.breaks.filter((_, j) => j !== i) })} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                        ))}
                                        <SettingsActionButton onClick={() => set({ breaks: [...form.breaks, { name: 'Receso', start_time: '10:00', end_time: '10:20' }] })}>Agregar receso</SettingsActionButton>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {form.mode === 'BLOCKED' && (
                        <div className="space-y-2">
                            <p className="text-sm font-bold text-slate-700">Horas en que no habrá clase</p>
                            {form.blocked_ranges.map((r, i) => (
                                <div key={i} className="grid grid-cols-2 2xl:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end p-3 bg-white rounded-2xl border border-slate-100">
                                    <WizardField label="De"><input type="time" className={wizardInput} value={r.start} onChange={e => set({ blocked_ranges: form.blocked_ranges.map((x, j) => j === i ? { ...x, start: e.target.value } : x) })} /></WizardField>
                                    <WizardField label="A"><input type="time" className={wizardInput} value={r.end} onChange={e => set({ blocked_ranges: form.blocked_ranges.map((x, j) => j === i ? { ...x, end: e.target.value } : x) })} /></WizardField>
                                    <WizardField label="Motivo (opcional)" className="col-span-2 2xl:col-span-1"><input className={wizardInput} value={r.label || ''} placeholder="Ej. Ensayo del festival" onChange={e => set({ blocked_ranges: form.blocked_ranges.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} /></WizardField>
                                    <button type="button" aria-label="Quitar horario" onClick={() => set({ blocked_ranges: form.blocked_ranges.filter((_, j) => j !== i) })} className="col-span-2 2xl:col-span-1 justify-self-end min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                                </div>
                            ))}
                            <SettingsActionButton onClick={() => set({ blocked_ranges: [...form.blocked_ranges, { start: '11:00', end: '12:00', label: '' }] })}>Agregar otro horario</SettingsActionButton>
                        </div>
                    )}

                    {/* Vista previa */}
                    {preview && preview.length > 0 && (
                        <div>
                            <p className="text-sm font-bold text-slate-700 mb-2">Así quedan las clases ese día</p>
                            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {preview.map(p => (
                                    <li key={p.n} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm border ${p.after ? 'bg-white border-slate-100' : 'bg-red-50 border-red-100'}`}>
                                        <span className="font-bold text-slate-700">{p.n}ª clase</span>
                                        {p.after
                                            ? <span className="text-slate-600"><span className="line-through text-slate-400 mr-1">{p.before.start}</span>{p.after.start}–{p.after.end}</span>
                                            : <span className="font-semibold text-red-700">Se suspende</span>}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    <WizardField label="Aviso para los docentes (opcional)">
                        <input className={wizardInput} value={form.note} onChange={e => set({ note: e.target.value })} placeholder="Ej. Los grupos de 3° se presentan en la explanada a las 9:00" />
                    </WizardField>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                        <button type="button" onClick={() => setForm(null)} className="min-h-[44px] px-5 rounded-2xl text-sm font-bold text-slate-600 hover:bg-white">Cancelar</button>
                        <button type="button" onClick={save} disabled={saving}
                            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 disabled:opacity-60">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {form.id ? 'Guardar cambios' : 'Guardar día especial'}
                        </button>
                    </div>
                </div>
            )}

            {/* Lista */}
            {upcoming.length === 0 && !form ? (
                <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    No hay días especiales próximos.{!readOnly && ' Usa “Agregar día especial” cuando tengas un festival, honores o una suspensión.'}
                </p>
            ) : (
                <ul className="space-y-2">
                    {upcoming.map(it => <Row key={it.id} it={it} readOnly={readOnly} onEdit={() => edit(it)} onDelete={() => remove(it)} />)}
                </ul>
            )}
            {past.length > 0 && (
                <div>
                    <button type="button" onClick={() => setShowPast(v => !v)} className="text-sm font-bold text-indigo-700 underline">
                        {showPast ? 'Ocultar' : 'Ver'} días especiales pasados ({past.length})
                    </button>
                    {showPast && <ul className="mt-2 space-y-2 opacity-70">{past.map(it => <Row key={it.id} it={it} readOnly={readOnly} onEdit={() => edit(it)} onDelete={() => remove(it)} />)}</ul>}
                </div>
            )}
        </SettingsCard>
    )
}

const rangeLabel = (it: SpecialDay) => it.end_date && it.end_date !== it.target_date
    ? `del ${formatDateEs(it.target_date)} al ${formatDateEs(it.end_date)}`
    : formatDateEs(it.target_date)

function Row({ it, readOnly, onEdit, onDelete }: { it: SpecialDay; readOnly: boolean; onEdit: () => void; onDelete: () => void }) {
    const detail = it.mode === 'SHORTENED'
        ? `De ${it.start_time} a ${it.end_time} · clases de ${it.module_duration} min`
        : it.mode === 'BLOCKED'
            ? `Sin clase de ${(it.blocked_ranges || []).map(r => `${r.start} a ${r.end}${r.label ? ` (${r.label})` : ''}`).join(', ')}`
            : 'No hay clases'
    const color = it.mode === 'NO_CLASSES' ? 'bg-red-50 text-red-800 border-red-100' : it.mode === 'BLOCKED' ? 'bg-amber-50 text-amber-900 border-amber-100' : 'bg-indigo-50 text-indigo-800 border-indigo-100'
    return (
        <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4">
            <div className="min-w-0">
                <p className="font-bold text-slate-900">{it.name}</p>
                <p className="text-sm text-slate-600">{rangeLabel(it)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className={`px-2 py-0.5 rounded-lg border text-xs font-bold ${color}`}>{MODE_LABEL[it.mode]}</span>
                    <span className="text-slate-600">{detail}</span>
                </p>
                {it.note && <p className="mt-1 text-sm text-slate-500">Aviso: {it.note}</p>}
            </div>
            {!readOnly && (
                <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={onEdit} aria-label={`Editar ${it.name}`} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={onDelete} aria-label={`Eliminar ${it.name}`} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
            )}
        </li>
    )
}
