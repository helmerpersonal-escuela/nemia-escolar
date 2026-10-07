import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, HeartHandshake, Loader2, Pencil, Plus, Printer, Save, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { groupName, studentName, useSchoolBasics, type BasicGroup, type BasicStudent } from '../../../hooks/useSchoolBasics'
import { SheetHeader, usePrint } from '../../../components/ui/PrintSheet'
import { askConfirm } from '../../../components/ui/ConfirmDialog'
import {
    LEVEL_LABEL, SCALE, SOCIO_DIMENSIONS, SOCIO_TEMPLATE, answeredCount, formatScore, newItemId, scoreStudent, summarizeGroup,
    type Answers, type InstrumentKind, type Item, type Level,
} from '../lib/instruments'

interface Instrument { id: string; kind: InstrumentKind; title: string; grade: string | null; subject: string | null; instructions: string | null; items: Item[]; status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'; school_year: string }
interface Result { student_id: string; group_id: string | null; answers: Answers; absent: boolean }

const input = 'min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:border-indigo-400 outline-none'
const btn = 'inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-black disabled:opacity-50'
const ghost = `${btn} bg-white border border-slate-200 text-slate-700 hover:bg-slate-50`
const KIND: Record<InstrumentKind, string> = { DIAGNOSTICO: 'Examen diagnóstico', SOCIOEMOCIONAL: 'Encuesta socioemocional' }
const STATUS: Record<string, string> = { DRAFT: 'Borrador', PUBLISHED: 'Lista para aplicar', CLOSED: 'Cerrada' }
const levelTone: Record<Level, string> = { APOYO: 'bg-rose-100 text-rose-800', DESARROLLO: 'bg-amber-100 text-amber-800', ESPERADO: 'bg-emerald-100 text-emerald-800' }
const KEY = 'school-instruments'
const asItems = (v: unknown): Item[] => Array.isArray(v) ? (v as Item[]).filter(i => i && typeof i.id === 'string') : []

type View = { mode: 'list' } | { mode: 'edit'; instrument: Instrument | null; kind: InstrumentKind } | { mode: 'capture' | 'results'; instrument: Instrument }

export const InstrumentsPage = () => {
    const basics = useSchoolBasics()
    const { tenantId, isLead } = basics
    const qc = useQueryClient()
    const { sheet, print } = usePrint()
    const [view, setView] = useState<View>({ mode: 'list' })

    const { data, isLoading, error } = useQuery({
        queryKey: [KEY, tenantId],
        enabled: !!tenantId,
        queryFn: async () => {
            const { data: rows, error: e } = await supabase.from('school_instruments').select('id, kind, title, grade, subject, instructions, items, status, school_year').eq('tenant_id', tenantId!).order('created_at', { ascending: false })
            if (e) throw e
            return ((rows ?? []) as Record<string, unknown>[]).map(r => ({ ...r, items: asItems(r.items) })) as Instrument[]
        },
    })
    const back = () => { qc.invalidateQueries({ queryKey: [KEY] }); setView({ mode: 'list' }) }

    if (isLoading || basics.isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    if (error || !data || !tenantId || !basics.data) return <p role="alert" className="m-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudieron cargar los instrumentos: {(error as Error | null)?.message ?? 'sin datos'}</p>

    const { groups, students, schoolYear } = basics.data
    const visible = data.filter(i => isLead || i.status !== 'DRAFT')
    const printInstrument = (i: Instrument) => print(<InstrumentSheet school={basics.schoolName} instrument={i} />)

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-5">
            {sheet}
            {view.mode === 'list' && (
                <>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">Diagnóstico y encuesta socioemocional</h1>
                            <p className="text-slate-600">Un mismo instrumento para toda la escuela: se imprime, cada docente lo aplica y captura, y aquí se interpreta. Ciclo {schoolYear}.</p>
                        </div>
                        {isLead && (
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setView({ mode: 'edit', instrument: null, kind: 'DIAGNOSTICO' })} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}><Plus className="w-4 h-4" /> Examen diagnóstico</button>
                                <button onClick={() => setView({ mode: 'edit', instrument: null, kind: 'SOCIOEMOCIONAL' })} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}><Plus className="w-4 h-4" /> Encuesta socioemocional</button>
                            </div>
                        )}
                    </div>
                    {visible.length === 0 ? (
                        <p className="bg-white border border-slate-200 rounded-3xl py-12 px-6 text-center text-slate-600 font-bold">{isLead ? 'Aún no hay instrumentos. Crea el examen diagnóstico o la encuesta socioemocional de la escuela.' : 'La dirección todavía no publica el diagnóstico ni la encuesta de este ciclo.'}</p>
                    ) : (
                        <ul className="grid md:grid-cols-2 gap-3">
                            {visible.map(i => (
                                <li key={i.id} className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">{i.kind === 'DIAGNOSTICO' ? <ClipboardList className="w-5 h-5" /> : <HeartHandshake className="w-5 h-5" />}</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-black text-slate-900">{i.title}</p>
                                            <p className="text-sm text-slate-600">{KIND[i.kind]} · {i.grade ? `${i.grade}° grado` : 'Todos los grados'}{i.subject ? ` · ${i.subject}` : ''} · {i.items.length} reactivos</p>
                                        </div>
                                        <span className={`text-xs font-black rounded-lg px-2 py-1 shrink-0 ${i.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{STATUS[i.status]}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={() => printInstrument(i)} className={ghost}><Printer className="w-4 h-4" /> Imprimir</button>
                                        {i.status !== 'DRAFT' && <button onClick={() => setView({ mode: 'capture', instrument: i })} disabled={i.status === 'CLOSED'} className={`${btn} bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}>Capturar resultados</button>}
                                        {i.status !== 'DRAFT' && <button onClick={() => setView({ mode: 'results', instrument: i })} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>Ver interpretación</button>}
                                        {isLead && <button onClick={() => setView({ mode: 'edit', instrument: i, kind: i.kind })} className={ghost}><Pencil className="w-4 h-4" /> Editar</button>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
            {view.mode === 'edit' && <Editor tenantId={tenantId} schoolYear={schoolYear} grades={[...new Set(groups.map(g => g.grade))]} instrument={view.instrument} kind={view.kind} onDone={back} />}
            {view.mode === 'capture' && <Capture tenantId={tenantId} instrument={view.instrument} groups={groups} students={students} onBack={back} />}
            {view.mode === 'results' && <Results school={basics.schoolName} instrument={view.instrument} groups={groups} students={students} onBack={back} print={print} />}
        </div>
    )
}

const BackBar = ({ title, sub, onBack, children }: { title: string; sub: string; onBack: () => void; children?: React.ReactNode }) => (
    <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} aria-label="Regresar" className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"><ArrowLeft className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-black text-slate-900 truncate">{title}</h1><p className="text-sm text-slate-600">{sub}</p></div>
        {children}
    </div>
)

// ---------------------------------------------------------------- Hoja para el alumno

const InstrumentSheet = ({ school, instrument: i }: { school: string; instrument: Instrument }) => (
    <>
        <div className="print-page">
            <SheetHeader school={school} title={i.title} right={<p>{i.grade ? `${i.grade}° grado` : ''}{i.subject ? ` · ${i.subject}` : ''}</p>} />
            <div className="grid grid-cols-4 gap-3 text-[10pt] mb-3">
                <p className="col-span-2 border-b border-black pb-1">Nombre:</p><p className="border-b border-black pb-1">Grupo:</p><p className="border-b border-black pb-1">Fecha:</p>
            </div>
            {i.instructions && <p className="text-[10pt] mb-3 whitespace-pre-wrap"><b>Instrucciones:</b> {i.instructions}</p>}
            {i.kind === 'SOCIOEMOCIONAL' ? (
                <table className="w-full text-[10pt] border-collapse">
                    <thead><tr className="border-b-2 border-black"><th className="text-left py-1">Marca con una X la opción que más se parece a ti</th>{SCALE.map(s => <th key={s} className="w-[11%] text-center text-[8.5pt] px-1">{s}</th>)}</tr></thead>
                    <tbody>{i.items.map((it, n) => <tr key={it.id} className="border-b border-black/40 break-inside-avoid"><td className="py-1.5 pr-2">{n + 1}. {it.text}</td>{SCALE.map(s => <td key={s} className="text-center"><span className="inline-block w-4 h-4 border border-black rounded-full" /></td>)}</tr>)}</tbody>
                </table>
            ) : (
                <ol className="text-[10.5pt] space-y-3">
                    {i.items.map((it, n) => <li key={it.id} className="break-inside-avoid"><p className="whitespace-pre-wrap">{n + 1}. {it.text}</p><div className="border-b border-black/40 h-[1.8em]" /></li>)}
                </ol>
            )}
        </div>
        {i.kind === 'DIAGNOSTICO' && (
            <div className="print-page">
                <SheetHeader school={school} title={`Clave y registro · ${i.title}`} right={<p>Solo para el docente</p>} />
                <table className="w-full text-[10pt] border-collapse">
                    <thead><tr className="border-b-2 border-black text-left"><th className="py-1 w-8">#</th><th>Tema</th><th>Respuesta esperada</th></tr></thead>
                    <tbody>{i.items.map((it, n) => <tr key={it.id} className="border-b border-black/40"><td className="py-1">{n + 1}</td><td className="pr-2">{it.topic}</td><td>{it.answer || ''}</td></tr>)}</tbody>
                </table>
                <p className="text-[9pt] mt-3">Al calificar, marca cada reactivo como acierto o error. Captura los resultados en VUNLEK, en «Diagnóstico y encuesta socioemocional».</p>
            </div>
        )}
    </>
)

// ---------------------------------------------------------------- Editor (directivos)

const Editor = ({ tenantId, schoolYear, grades, instrument, kind, onDone }: { tenantId: string; schoolYear: string; grades: string[]; instrument: Instrument | null; kind: InstrumentKind; onDone: () => void }) => {
    const [title, setTitle] = useState(instrument?.title ?? (kind === 'DIAGNOSTICO' ? 'Examen diagnóstico' : 'Encuesta socioemocional de inicio de ciclo'))
    const [grade, setGrade] = useState(instrument?.grade ?? '')
    const [subject, setSubject] = useState(instrument?.subject ?? '')
    const [instructions, setInstructions] = useState(instrument?.instructions ?? (kind === 'SOCIOEMOCIONAL' ? 'No hay respuestas buenas ni malas. Contesta con sinceridad; lo que marques sirve para que tu escuela te acompañe mejor.' : ''))
    const [items, setItems] = useState<Item[]>(instrument?.items ?? (kind === 'SOCIOEMOCIONAL' ? SOCIO_TEMPLATE.map(t => ({ ...t, id: newItemId() })) : []))
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')
    const set = (id: string, patch: Partial<Item>) => setItems(items.map(i => i.id === id ? { ...i, ...patch } : i))
    const topics = [...new Set([...(kind === 'SOCIOEMOCIONAL' ? SOCIO_DIMENSIONS : []), ...items.map(i => i.topic).filter(Boolean)])]
    const valid = items.filter(i => i.text.trim())

    const save = async (status: Instrument['status']) => {
        if (!title.trim()) return setErr('Escribe el título.')
        if (status === 'PUBLISHED' && valid.length < 3) return setErr('Agrega al menos tres reactivos antes de publicar.')
        setBusy(true); setErr('')
        const row = { tenant_id: tenantId, school_year: instrument?.school_year ?? schoolYear, kind, title: title.trim(), grade: grade || null, subject: subject.trim() || null, instructions: instructions.trim() || null, items: valid.map(i => ({ ...i, text: i.text.trim(), topic: i.topic.trim() || 'General' })), status, updated_at: new Date().toISOString() }
        const { error } = instrument ? await supabase.from('school_instruments').update(row).eq('id', instrument.id) : await supabase.from('school_instruments').insert(row)
        setBusy(false)
        if (error) return setErr(error.message)
        onDone()
    }

    return (
        <div className="space-y-4">
            <BackBar title={instrument ? 'Editar instrumento' : `Nuevo: ${KIND[kind].toLowerCase()}`} sub="Lo que publiques aquí es lo que aplica toda la escuela." onBack={onDone} />
            <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3">
                <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Título</span><input value={title} onChange={e => setTitle(e.target.value)} maxLength={140} className={`${input} w-full`} /></label>
                <div className="flex flex-wrap gap-2">
                    <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Grado</span>
                        <select value={grade} onChange={e => setGrade(e.target.value)} className={input}><option value="">Todos los grados</option>{grades.map(g => <option key={g} value={g}>{g}°</option>)}</select></label>
                    {kind === 'DIAGNOSTICO' && <label className="block flex-1 min-w-48"><span className="block text-xs font-black text-slate-600 mb-1">Materia o campo formativo</span><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Matemáticas, Lenguajes…" className={`${input} w-full`} /></label>}
                </div>
                <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Instrucciones para las y los alumnos</span><textarea rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} className={`${input} w-full py-2 resize-y`} /></label>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-black text-slate-900">Reactivos ({valid.length})</h2>
                    <p className="text-xs text-slate-500">{kind === 'DIAGNOSTICO' ? 'El tema agrupa la interpretación: así se ve en qué contenidos necesita apoyo cada alumno.' : 'Escala de respuesta: Nunca, A veces, Casi siempre, Siempre.'}</p>
                </div>
                <datalist id="topics">{topics.map(t => <option key={t} value={t} />)}</datalist>
                {items.map((it, n) => (
                    <div key={it.id} className="border border-slate-200 rounded-2xl p-3 space-y-2">
                        <div className="flex gap-2">
                            <span className="text-sm font-black text-slate-500 pt-2.5 w-6 shrink-0">{n + 1}.</span>
                            <textarea aria-label={`Reactivo ${n + 1}`} rows={kind === 'DIAGNOSTICO' ? 2 : 1} value={it.text} onChange={e => set(it.id, { text: e.target.value })} placeholder={kind === 'DIAGNOSTICO' ? 'Pregunta o ejercicio' : 'Afirmación en primera persona'} className={`${input} flex-1 py-2 resize-y`} />
                            <button onClick={() => setItems(items.filter(x => x.id !== it.id))} aria-label={`Quitar reactivo ${n + 1}`} className="p-2 h-11 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pl-8">
                            <input aria-label={`${kind === 'DIAGNOSTICO' ? 'Tema' : 'Dimensión'} del reactivo ${n + 1}`} list="topics" value={it.topic} onChange={e => set(it.id, { topic: e.target.value })} placeholder={kind === 'DIAGNOSTICO' ? 'Tema o contenido' : 'Dimensión'} className={`${input} flex-1 min-w-40`} />
                            {kind === 'DIAGNOSTICO'
                                ? <input aria-label={`Respuesta esperada del reactivo ${n + 1}`} value={it.answer ?? ''} onChange={e => set(it.id, { answer: e.target.value })} placeholder="Respuesta esperada (para la clave)" className={`${input} flex-1 min-w-40`} />
                                : <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 min-h-11"><input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={!!it.reverse} onChange={e => set(it.id, { reverse: e.target.checked })} /> Está en negativo («Siempre» es desfavorable)</label>}
                        </div>
                    </div>
                ))}
                <button onClick={() => setItems([...items, { id: newItemId(), text: '', topic: items[items.length - 1]?.topic ?? '' }])} className={`${btn} bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}><Plus className="w-4 h-4" /> Agregar reactivo</button>
            </div>

            {err && <p role="alert" className="flex items-start gap-2 text-sm font-bold rounded-2xl px-4 py-3 bg-rose-50 text-rose-800"><AlertTriangle className="w-4 h-4 mt-0.5" />{err}</p>}
            {instrument && instrument.status !== 'DRAFT' && <p className="text-sm text-amber-800 bg-amber-50 rounded-2xl px-4 py-3 font-bold">Este instrumento ya está publicado. Si quitas un reactivo, lo que ya se capturó de ese reactivo deja de contarse.</p>}
            <div className="flex flex-wrap justify-end gap-2">
                <button onClick={() => save('DRAFT')} disabled={busy} className={ghost}>Guardar como borrador</button>
                {instrument?.status === 'PUBLISHED' && <button onClick={() => save('CLOSED')} disabled={busy} className={ghost}>Cerrar la captura</button>}
                <button onClick={() => save('PUBLISHED')} disabled={busy} className={`${btn} bg-indigo-600 text-white`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Publicar para los docentes</button>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- Captura (docentes)

function useResults(instrumentId: string) {
    return useQuery({
        queryKey: ['instrument-results', instrumentId],
        queryFn: async () => {
            const out: Result[] = []
            for (let from = 0; from < 10_000; from += 1000) {
                const { data, error } = await supabase.from('instrument_results').select('student_id, group_id, answers, absent').eq('instrument_id', instrumentId).range(from, from + 999)
                if (error) throw error
                out.push(...((data ?? []) as Result[]))
                if (!data || data.length < 1000) break
            }
            return out
        },
    })
}

const Capture = ({ tenantId, instrument, groups, students, onBack }: { tenantId: string; instrument: Instrument; groups: BasicGroup[]; students: BasicStudent[]; onBack: () => void }) => {
    const qc = useQueryClient()
    const saved = useResults(instrument.id)
    const myGroups = groups.filter(g => !instrument.grade || g.grade === instrument.grade)
    const [groupId, setGroupId] = useState(myGroups[0]?.id ?? '')
    const [draft, setDraft] = useState<Record<string, { answers: Answers; absent: boolean }>>({})
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const roster = students.filter(s => s.group_id === groupId && s.status !== 'INACTIVE')
    const dirty = Object.keys(draft).length
    const rowOf = (id: string) => draft[id] ?? (() => { const r = saved.data?.find(x => x.student_id === id); return { answers: r?.answers ?? {}, absent: r?.absent ?? false } })()
    const setCell = (id: string, itemId: string, v: number | null) => {
        const r = rowOf(id); const answers = { ...r.answers }
        if (v === null) delete answers[itemId]; else answers[itemId] = v
        setDraft({ ...draft, [id]: { ...r, answers } })
    }
    const changeGroup = async (id: string) => {
        if (dirty && !(await askConfirm('Hay capturas sin guardar en este grupo. ¿Cambiar de grupo y descartarlas?'))) return
        setDraft({}); setGroupId(id); setMsg(null)
    }
    const save = async () => {
        setBusy(true); setMsg(null)
        const rows = Object.entries(draft).map(([student_id, r]) => ({ tenant_id: tenantId, instrument_id: instrument.id, student_id, group_id: groupId, answers: r.absent ? {} : r.answers, absent: r.absent, updated_at: new Date().toISOString() }))
        const { error } = await supabase.from('instrument_results').upsert(rows, { onConflict: 'instrument_id,student_id' })
        setBusy(false)
        if (error) return setMsg({ ok: false, text: error.message })
        setDraft({}); setMsg({ ok: true, text: `Se guardó la captura de ${rows.length} alumno${rows.length === 1 ? '' : 's'}.` })
        qc.invalidateQueries({ queryKey: ['instrument-results', instrument.id] })
    }
    const diag = instrument.kind === 'DIAGNOSTICO'
    const complete = roster.filter(s => { const r = rowOf(s.id); return r.absent || answeredCount(instrument.items, r.answers) === instrument.items.length }).length

    return (
        <div className="space-y-4">
            <BackBar title={`Capturar · ${instrument.title}`} sub={diag ? 'Toca cada casilla: una vez es acierto (✓), dos es error (✗), tres la deja vacía.' : 'Elige en cada reactivo lo que marcó el alumno: 1 Nunca, 2 A veces, 3 Casi siempre, 4 Siempre.'} onBack={onBack}>
                <select aria-label="Grupo" value={groupId} onChange={e => changeGroup(e.target.value)} className={input}>{myGroups.map(g => <option key={g.id} value={g.id}>{groupName(g)}</option>)}</select>
            </BackBar>
            {msg && <p role={msg.ok ? 'status' : 'alert'} className={`flex items-start gap-2 text-sm font-bold rounded-2xl px-4 py-3 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}{msg.text}</p>}
            {saved.isLoading ? <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div> : roster.length === 0 ? <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">Este grupo no tiene alumnos.</p> : (
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
                    <div className="table-scroll">
                        <table className="text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="sticky left-0 bg-slate-50 text-left px-3 py-2 font-black text-slate-700 min-w-52">Alumno ({complete} de {roster.length} completos)</th>
                                    <th className="px-2 py-2 text-xs font-black text-slate-600">No lo presentó</th>
                                    {instrument.items.map((it, n) => <th key={it.id} title={`${it.topic}: ${it.text}`} className="px-1 py-2 text-xs font-black text-slate-600 min-w-10">{n + 1}</th>)}
                                    <th className="px-3 py-2 text-xs font-black text-slate-600">Resultado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roster.map(s => {
                                    const r = rowOf(s.id)
                                    const score = r.absent ? null : scoreStudent(instrument.kind, instrument.items, r.answers)
                                    return (
                                        <tr key={s.id} className="border-t border-slate-100">
                                            <th scope="row" className="sticky left-0 bg-white text-left px-3 py-1.5 font-bold text-slate-800 whitespace-nowrap">{studentName(s)}</th>
                                            <td className="text-center"><input type="checkbox" aria-label={`${studentName(s)} no lo presentó`} className="accent-slate-600 w-4 h-4" checked={r.absent} onChange={e => setDraft({ ...draft, [s.id]: { ...r, absent: e.target.checked } })} /></td>
                                            {instrument.items.map((it, n) => {
                                                const v = r.answers[it.id]
                                                return (
                                                    <td key={it.id} className="p-0.5 text-center">
                                                        {diag ? (
                                                            <button disabled={r.absent} aria-label={`${studentName(s)}, reactivo ${n + 1}: ${v === 1 ? 'acierto' : v === 0 ? 'error' : 'sin capturar'}`} onClick={() => setCell(s.id, it.id, v === undefined ? 1 : v === 1 ? 0 : null)}
                                                                className={`w-9 h-9 rounded-lg font-black disabled:opacity-30 ${v === 1 ? 'bg-emerald-100 text-emerald-800' : v === 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{v === 1 ? '✓' : v === 0 ? '✗' : '·'}</button>
                                                        ) : (
                                                            <select disabled={r.absent} aria-label={`${studentName(s)}, reactivo ${n + 1}`} value={v ?? ''} onChange={e => setCell(s.id, it.id, e.target.value ? Number(e.target.value) : null)} className="w-11 h-9 rounded-lg border border-slate-200 bg-white text-sm font-black text-center disabled:opacity-30">
                                                                <option value="">·</option>{SCALE.map((label, k) => <option key={label} value={k + 1} title={label}>{k + 1}</option>)}
                                                            </select>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                            <td className="px-3 whitespace-nowrap">{r.absent ? <span className="text-xs font-bold text-slate-500">No presentó</span> : score ? <span className={`text-xs font-black rounded-lg px-2 py-1 ${levelTone[score.level]}`}>{formatScore(instrument.kind, score.value)}</span> : <span className="text-xs text-slate-400">—</span>}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3 sticky bottom-3">
                {dirty > 0 && <span className="text-sm font-bold text-amber-800 bg-amber-50 rounded-xl px-3 py-2">{dirty} alumno{dirty === 1 ? '' : 's'} con cambios sin guardar</span>}
                <button onClick={save} disabled={busy || !dirty} className={`${btn} bg-indigo-600 text-white shadow-lg`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar captura</button>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- Interpretación

const Results = ({ school, instrument, groups, students, onBack, print }: { school: string; instrument: Instrument; groups: BasicGroup[]; students: BasicStudent[]; onBack: () => void; print: (n: React.ReactNode) => void }) => {
    const saved = useResults(instrument.id)
    const [groupId, setGroupId] = useState('')
    const [only, setOnly] = useState<'ALL' | Level>('ALL')
    const scope = groups.filter(g => !instrument.grade || g.grade === instrument.grade)
    const rows = useMemo(() => (saved.data ?? []).filter(r => !r.absent && (!groupId || r.group_id === groupId)), [saved.data, groupId])
    const summary = useMemo(() => summarizeGroup(instrument.kind, instrument.items, rows.map(r => r.answers)), [instrument, rows])
    const expected = students.filter(s => s.status !== 'INACTIVE' && (groupId ? s.group_id === groupId : scope.some(g => g.id === s.group_id))).length
    const table = useMemo(() => rows.map(r => ({ r, student: students.find(s => s.id === r.student_id), score: scoreStudent(instrument.kind, instrument.items, r.answers) }))
        .filter((x): x is typeof x & { score: NonNullable<typeof x.score> } => !!x.score && !!x.student)
        .sort((a, b) => a.score.value - b.score.value), [rows, students, instrument])
    const shown = table.filter(x => only === 'ALL' || x.score.level === only)
    const diag = instrument.kind === 'DIAGNOSTICO'
    const lowest = summary.topics[0]
    const where = groupId ? groupName(groups.find(g => g.id === groupId)) : instrument.grade ? `${instrument.grade}° grado` : 'toda la escuela'

    const reading = summary.captured === 0 ? [] : [
        `Se capturaron ${summary.captured} de ${expected} alumnos de ${where}.`,
        `${summary.levels.APOYO} ${summary.levels.APOYO === 1 ? 'requiere' : 'requieren'} apoyo, ${summary.levels.DESARROLLO} ${summary.levels.DESARROLLO === 1 ? 'está' : 'están'} en desarrollo y ${summary.levels.ESPERADO} en el nivel esperado.`,
        lowest ? `${diag ? 'El tema' : 'La dimensión'} con resultado más bajo es «${lowest.topic}» (${formatScore(instrument.kind, lowest.value)}); ${lowest.support} alumno${lowest.support === 1 ? ' requiere' : 's requieren'} apoyo ahí.` : '',
        diag && summary.hardest[0] ? `El reactivo con menos aciertos (${summary.hardest[0].pct}%) fue: «${summary.hardest[0].text}».` : '',
    ].filter(Boolean)

    const body = (
        <>
            {reading.length > 0 && <ul className="list-disc pl-5 space-y-1 text-sm text-slate-800">{reading.map(t => <li key={t}>{t}</li>)}</ul>}
        </>
    )

    if (saved.isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    return (
        <div className="space-y-4">
            <BackBar title={`Interpretación · ${instrument.title}`} sub={`${KIND[instrument.kind]} · ${where}`} onBack={onBack}>
                <select aria-label="Grupo" value={groupId} onChange={e => setGroupId(e.target.value)} className={input}><option value="">{instrument.grade ? `Todo ${instrument.grade}°` : 'Toda la escuela'}</option>{scope.map(g => <option key={g.id} value={g.id}>{groupName(g)}</option>)}</select>
                <button onClick={() => print(
                    <div className="print-page">
                        <SheetHeader school={school} title={`Resultados · ${instrument.title}`} right={<p>{where}</p>} />
                        <ul className="list-disc pl-5 text-[10pt] mb-3">{reading.map(t => <li key={t}>{t}</li>)}</ul>
                        <table className="w-full text-[9.5pt] border-collapse"><thead><tr className="text-left border-b-2 border-black"><th className="py-1">Alumno</th><th>Grupo</th><th>Resultado</th><th>Nivel</th><th>Requiere apoyo en</th></tr></thead>
                            <tbody>{table.map(x => <tr key={x.r.student_id} className="border-b border-black/30"><td className="py-1 pr-2">{studentName(x.student)}</td><td className="pr-2">{groupName(groups.find(g => g.id === x.r.group_id))}</td><td className="pr-2">{formatScore(instrument.kind, x.score.value)}</td><td className="pr-2">{LEVEL_LABEL[x.score.level]}</td><td>{x.score.byTopic.filter(t => t.level === 'APOYO').map(t => t.topic).join(', ')}</td></tr>)}</tbody></table>
                    </div>)} disabled={!summary.captured} className={ghost}><Printer className="w-4 h-4" /> Imprimir</button>
            </BackBar>

            {summary.captured === 0 ? <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">Todavía no hay resultados capturados{groupId ? ' en este grupo' : ''}.</p> : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white border border-slate-200 rounded-3xl p-4"><p className="text-2xl font-black text-slate-900">{summary.captured}<span className="text-base text-slate-500"> de {expected}</span></p><p className="text-sm font-bold text-slate-600">Alumnos capturados</p></div>
                        {(['APOYO', 'DESARROLLO', 'ESPERADO'] as Level[]).map(l => (
                            <button key={l} onClick={() => setOnly(only === l ? 'ALL' : l)} aria-pressed={only === l} className={`text-left bg-white border rounded-3xl p-4 hover:border-indigo-300 ${only === l ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
                                <p className="text-2xl font-black text-slate-900">{summary.levels[l]}</p><p className={`inline-block text-xs font-black rounded-lg px-2 py-1 ${levelTone[l]}`}>{LEVEL_LABEL[l]}</p>
                            </button>
                        ))}
                    </div>

                    <section className="bg-white border border-slate-200 rounded-3xl p-4 space-y-2">
                        <h2 className="font-black text-slate-900">Qué dicen los resultados</h2>
                        {body}
                        <p className="text-xs text-slate-500">{diag ? 'Niveles: esperado 80% o más de aciertos, en desarrollo de 60 a 79%, requiere apoyo menos de 60%.' : 'Niveles sobre el promedio de 1 a 4: esperado 3.0 o más, en desarrollo de 2.2 a 2.9, requiere apoyo menos de 2.2. Es una señal para acercarse al alumno, no un diagnóstico clínico.'}</p>
                    </section>

                    <section className="bg-white border border-slate-200 rounded-3xl p-4">
                        <h2 className="font-black text-slate-900 mb-2">{diag ? 'Por tema, del más bajo al más alto' : 'Por dimensión, de la más baja a la más alta'}</h2>
                        <ul className="space-y-2">
                            {summary.topics.map(t => {
                                const pct = diag ? t.value : (t.value / 4) * 100
                                return (
                                    <li key={t.topic} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                                        <span className="text-sm font-bold text-slate-800 truncate">{t.topic}</span>
                                        <span className="hidden sm:block h-2.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true"><span className={`block h-full rounded-full ${t.level === 'APOYO' ? 'bg-rose-500' : t.level === 'DESARROLLO' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></span>
                                        <span className="text-xs font-black text-slate-700 whitespace-nowrap">{formatScore(instrument.kind, t.value)} · {LEVEL_LABEL[t.level]}{t.support ? ` · ${t.support} con apoyo` : ''}</span>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>

                    {diag && summary.hardest.length > 0 && (
                        <section className="bg-white border border-slate-200 rounded-3xl p-4">
                            <h2 className="font-black text-slate-900 mb-2">Reactivos con menos aciertos</h2>
                            <ol className="space-y-1 text-sm text-slate-800 list-decimal pl-5">{summary.hardest.map(h => <li key={h.text}><span className="font-black">{h.pct}%</span> · {h.text}</li>)}</ol>
                        </section>
                    )}

                    <section className="bg-white border border-slate-200 rounded-3xl p-4">
                        <h2 className="font-black text-slate-900 mb-2">Alumno por alumno {only !== 'ALL' && <button onClick={() => setOnly('ALL')} className="ml-2 text-xs font-black text-indigo-700 underline">Ver todos</button>}</h2>
                        <ul className="divide-y divide-slate-100">
                            {shown.map(x => {
                                const support = x.score.byTopic.filter(t => t.level === 'APOYO').map(t => t.topic)
                                return (
                                    <li key={x.r.student_id} className="py-2 flex flex-wrap items-center gap-2">
                                        <span className="flex-1 min-w-48"><span className="block text-sm font-black text-slate-900">{studentName(x.student)} <span className="font-bold text-slate-500">· {groupName(groups.find(g => g.id === x.r.group_id))}</span></span>
                                            {support.length > 0 && <span className="block text-sm text-slate-600">Requiere apoyo en: {support.join(', ')}</span>}</span>
                                        <span className="text-sm font-black text-slate-700">{formatScore(instrument.kind, x.score.value)}</span>
                                        <span className={`text-xs font-black rounded-lg px-2 py-1 ${levelTone[x.score.level]}`}>{LEVEL_LABEL[x.score.level]}</span>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                </>
            )}
        </div>
    )
}
