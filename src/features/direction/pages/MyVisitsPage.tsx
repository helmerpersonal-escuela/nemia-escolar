import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { groupName, useSchoolBasics } from '../../../hooks/useSchoolBasics'
import { AccordionSection, useAccordion } from '../../../components/ui/Accordion'
import { formatDateEs } from '../../../components/ui/DateInput'
import { agreementSummary, asAgreements, folioLabel } from '../../../lib/agreements'
import { OBSERVED_LABEL, VISIT_STATUS, visitSummary, type IndicatorRecord } from '../lib/visits'

interface MyVisit { id: string; folio: number | null; group_id: string | null; subject: string | null; scheduled_date: string; scheduled_time: string | null; purpose: string | null; status: string; observer_name: string | null; indicators: unknown; facts: string | null; feedback_date: string | null; agreements: unknown; next_review: string | null; teacher_note: string | null }

const asRecords = (v: unknown): IndicatorRecord[] => Array.isArray(v) ? (v as IndicatorRecord[]).filter(r => r && typeof r.id === 'string') : []
const tone: Record<string, string> = { PROGRAMADA: 'bg-slate-100 text-slate-700', REALIZADA: 'bg-amber-100 text-amber-800', RETROALIMENTADA: 'bg-indigo-50 text-indigo-700', CERRADA: 'bg-emerald-50 text-emerald-700' }
const obsTone: Record<string, string> = { OBSERVADO: 'text-emerald-700', PARCIAL: 'text-amber-700', NO_OBSERVADO: 'text-slate-700', NO_APLICA: 'text-slate-400' }

/** Lo que el docente ve de sus visitas de acompañamiento: cuándo es, qué se registró y qué se acordó. */
export const MyVisitsPage = () => {
    const basics = useSchoolBasics()
    const { myId } = basics
    const { data, isLoading, error } = useQuery({
        queryKey: ['my-visits', myId],
        enabled: !!myId,
        queryFn: async () => {
            const { data: rows, error: e } = await supabase.from('classroom_visits')
                .select('id, folio, group_id, subject, scheduled_date, scheduled_time, purpose, status, observer_name, indicators, facts, feedback_date, agreements, next_review, teacher_note')
                .eq('teacher_id', myId!).order('scheduled_date', { ascending: false })
            if (e) throw e
            return (rows ?? []) as MyVisit[]
        },
    })
    if (isLoading || basics.isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    if (error) return <p role="alert" className="m-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudieron cargar tus visitas: {(error as Error).message}</p>
    const visits = data ?? []
    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-5">
            <div>
                <h1 className="text-3xl font-black text-slate-900">Mis visitas de acompañamiento</h1>
                <p className="text-slate-600">Aquí ves cuándo te visitan, qué se registró de tu clase y los acuerdos de la retroalimentación. Se anotan hechos observados, no calificaciones.</p>
            </div>
            {visits.length === 0 ? <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">Todavía no tienes visitas programadas.</p>
                : <ul className="space-y-3">{visits.map(v => <li key={v.id}><VisitCard visit={v} group={groupName(basics.data?.groups.find(g => g.id === v.group_id))} /></li>)}</ul>}
        </div>
    )
}

const SECTIONS = ['record', 'feedback', 'note'] as const

const VisitCard = ({ visit, group }: { visit: MyVisit; group: string }) => {
    const qc = useQueryClient()
    const done = visit.status !== 'PROGRAMADA'
    const acc = useAccordion(SECTIONS, null)
    const fold = (id: typeof SECTIONS[number]) => ({ open: acc.isOpen(id), onToggle: () => acc.toggle(id) })
    const records = asRecords(visit.indicators).filter(r => r.observed)
    const summary = visitSummary(asRecords(visit.indicators))
    const agreements = asAgreements(visit.agreements)
    const [note, setNote] = useState(visit.teacher_note ?? '')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const areas = [...new Set(records.map(r => r.area))]

    const save = async () => {
        setBusy(true); setMsg(null)
        const { error } = await supabase.rpc('visit_add_teacher_note', { p_visit: visit.id, p_note: note })
        setBusy(false)
        setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Tu comentario quedó guardado; la dirección lo verá en la visita.' })
        if (!error) qc.invalidateQueries({ queryKey: ['my-visits'] })
    }

    return (
        <article className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3">
            <div className="flex flex-wrap items-start gap-3">
                <span className="text-xs font-black bg-slate-900 text-white rounded-lg px-2 py-1 tabular-nums shrink-0">{folioLabel('VA', visit.folio)}</span>
                <div className="min-w-0 flex-1 basis-56">
                    <h2 className="font-black text-slate-900">{formatDateEs(visit.scheduled_date)}{visit.scheduled_time ? ` · ${visit.scheduled_time.slice(0, 5)} h` : ''}</h2>
                    <p className="text-sm text-slate-600">{group}{visit.subject ? ` · ${visit.subject}` : ''}{visit.observer_name ? ` · Te acompaña: ${visit.observer_name}` : ''}</p>
                    {visit.purpose && <p className="text-sm text-slate-800 mt-1"><span className="font-black">Propósito:</span> {visit.purpose}</p>}
                </div>
                <span className={`text-xs font-black rounded-lg px-2 py-1 shrink-0 ${tone[visit.status]}`}>{VISIT_STATUS[visit.status]}</span>
            </div>
            {!done ? <p className="text-sm text-slate-600 bg-slate-50 rounded-2xl px-4 py-3">Después de la visita verás aquí lo que se registró y, tras la reunión, los acuerdos.</p> : (
                <div className="space-y-3">
                    <AccordionSection title="Lo que se registró" {...fold('record')} summary={`${summary.observed} observados · ${summary.partial} en parte · ${summary.notObserved} no observados`}>
                        {areas.map(a => (
                            <div key={a} className="mb-3">
                                <h3 className="text-sm font-black text-slate-900 mb-1">{a}</h3>
                                <ul className="space-y-1.5">
                                    {records.filter(r => r.area === a).map(r => (
                                        <li key={r.id} className="text-sm text-slate-800"><span className={`font-black ${obsTone[r.observed!]}`}>{OBSERVED_LABEL[r.observed!]}:</span> {r.text}
                                            {r.fact.trim() && <span className="block pl-3 text-slate-600">Hecho: {r.fact}</span>}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        {visit.facts && <p className="text-sm text-slate-800 whitespace-pre-wrap"><span className="font-black">Otros hechos:</span> {visit.facts}</p>}
                    </AccordionSection>
                    <AccordionSection title="Acuerdos de la retroalimentación" {...fold('feedback')} tone={visit.feedback_date ? 'normal' : 'warn'} summary={visit.feedback_date ? agreementSummary(agreements) : 'Aún no se han reunido'}>
                        {!visit.feedback_date ? <p className="text-sm text-slate-600">La reunión de retroalimentación todavía no se registra.</p> : (
                            <>
                                <p className="text-sm text-slate-600 mb-2">Reunión del {formatDateEs(visit.feedback_date)}.{visit.next_review ? ` Siguiente revisión: ${formatDateEs(visit.next_review)}.` : ''}</p>
                                {agreements.length === 0 ? <p className="text-sm text-slate-500">No se registraron acuerdos.</p> : (
                                    <ul className="space-y-2">{agreements.map(a => (
                                        <li key={a.id} className={`border rounded-2xl px-3 py-2 text-sm ${a.done_at ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
                                            <p className="font-bold text-slate-900">{a.text}</p>
                                            <p className="text-slate-600">{a.responsible || 'Sin responsable'}{a.due_date ? ` · revisar el ${formatDateEs(a.due_date, true)}` : ''}{a.done_at ? ` · cumplido el ${formatDateEs(a.done_at, true)}` : ''}</p>
                                        </li>))}</ul>
                                )}
                            </>
                        )}
                    </AccordionSection>
                    <AccordionSection title="Mi comentario" {...fold('note')} summary={visit.teacher_note ? visit.teacher_note : 'Sin comentario'}>
                        <textarea aria-label="Mi comentario sobre la visita" rows={3} value={note} onChange={e => setNote(e.target.value)} disabled={visit.status === 'CERRADA'} placeholder="Tu lectura de la sesión, lo que necesitas o lo que propones" className="w-full min-h-11 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:border-indigo-400 outline-none resize-y disabled:opacity-60" />
                        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`flex items-start gap-2 text-sm font-bold rounded-2xl px-4 py-3 mt-2 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}{msg.text}</p>}
                        {visit.status === 'CERRADA' ? <p className="text-xs text-slate-500 mt-2">La visita ya está cerrada.</p>
                            : <button onClick={save} disabled={busy || note.trim().length < 3 || note === (visit.teacher_note ?? '')} className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-black bg-indigo-600 text-white disabled:opacity-50 mt-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar mi comentario</button>}
                    </AccordionSection>
                </div>
            )}
        </article>
    )
}
