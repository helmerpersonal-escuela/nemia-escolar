import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Eye, ListChecks, Loader2, Plus, Printer, ShieldAlert, Users, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { groupName, studentName, useSchoolBasics, type BasicGroup, type BasicStaff, type BasicStudent } from '../../../hooks/useSchoolBasics'
import { AccordionSection, AccordionToggleAll, useAccordion } from '../../../components/ui/Accordion'
import { AgreementsEditor } from '../../../components/ui/AgreementsEditor'
import { EvidenceBox, asEvidence } from '../../../components/ui/EvidenceBox'
import { DateInput, formatDateEs } from '../../../components/ui/DateInput'
import { SheetField, SheetHeader, SheetSignatures, usePrint } from '../../../components/ui/PrintSheet'
import { agreementStats, agreementSummary, asAgreements, cleanAgreements, folioLabel, type Agreement } from '../../../lib/agreements'
import { matchesName } from '../../students/lib/studentReport'
import { scoreStudent, type Answers, type InstrumentKind, type Item } from '../../instruments/lib/instruments'
import {
    AREAS, BASE_INDICATORS, LOG_KIND, OBSERVED_LABEL, VISIT_STATUS, blankRecords, buildRiskCases, judgmentWords, visitSummary,
    type Indicator, type IndicatorRecord, type Observed, type RiskRow,
} from '../lib/visits'

interface LogEntry { id: string; folio: number | null; kind: string; area: string; occurred_at: string; attendees: string | null; student_id: string | null; teacher_id: string | null; subject: string; facts: string | null; agreements: unknown; next_date: string | null; status: string; author_name: string | null }
interface Visit { id: string; folio: number | null; teacher_id: string; group_id: string | null; subject: string | null; scheduled_date: string; scheduled_time: string | null; purpose: string | null; status: string; observer_name: string | null; indicators: unknown; facts: string | null; evidence: unknown; feedback_date: string | null; teacher_comment: string | null; agreements: unknown; next_review: string | null }
interface OwnIndicator { id: string; area: string; text: string; source: 'ESCUELA' | 'AUTORIDAD'; active: boolean }
type PrintFn = (n: React.ReactNode) => void

const input = 'min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:border-indigo-400 outline-none'
const btn = 'inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-black disabled:opacity-50'
const ghost = `${btn} bg-white border border-slate-200 text-slate-700 hover:bg-slate-50`
const primary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const asRecords = (v: unknown): IndicatorRecord[] => Array.isArray(v) ? (v as IndicatorRecord[]).filter(r => r && typeof r.id === 'string') : []
const KEY = 'direction-log'

const Notice = ({ msg }: { msg: { ok: boolean; text: string } | null }) => msg ? (
    <p role={msg.ok ? 'status' : 'alert'} className={`flex items-start gap-2 text-sm font-bold rounded-2xl px-4 py-3 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}{msg.text}</p>
) : null

/** Aviso cuando el texto califica en vez de describir. No impide guardar. */
const FactHint = ({ text }: { text: string }) => {
    const words = judgmentWords(text)
    return words.length ? <p className="text-xs font-bold text-amber-800 bg-amber-50 rounded-lg px-2 py-1 mt-1">«{words.join('», «')}» suena a opinión. Describe lo que viste u oíste: quién, qué hizo, cuántos, en qué momento.</p> : null
}

const Modal = ({ title, sub, onClose, children, footer, actions }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; actions?: React.ReactNode }) => (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="text-xl font-black text-slate-900 truncate">{title}</h2>{sub && <p className="text-sm text-slate-600">{sub}</p>}</div>
                <div className="flex gap-1 shrink-0">{actions}<button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button></div>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
            {footer && <div className="p-5 border-t border-slate-100 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
    </div>
)
const Label = ({ text, children, className = '' }: { text: string; children: React.ReactNode; className?: string }) => <label className={`block ${className}`}><span className="block text-xs font-black text-slate-600 mb-1">{text}</span>{children}</label>

export const DirectionLogPage = () => {
    const basics = useSchoolBasics()
    const { tenantId } = basics
    const qc = useQueryClient()
    const refresh = () => qc.invalidateQueries({ queryKey: [KEY] })
    const { sheet, print } = usePrint()
    const [tab, setTab] = useState<'log' | 'visits' | 'risk' | 'indicators'>('log')
    const [entry, setEntry] = useState<Partial<LogEntry> | null>(null)
    const [visitId, setVisitId] = useState<string | null>(null)
    const [scheduling, setScheduling] = useState(false)

    const { data, isLoading, error } = useQuery({
        queryKey: [KEY, tenantId],
        enabled: !!tenantId,
        queryFn: async () => {
            const [log, visits, ind] = await Promise.all([
                supabase.from('direction_log').select('id, folio, kind, area, occurred_at, attendees, student_id, teacher_id, subject, facts, agreements, next_date, status, author_name').eq('tenant_id', tenantId!).order('occurred_at', { ascending: false }).limit(1000),
                supabase.from('classroom_visits').select('id, folio, teacher_id, group_id, subject, scheduled_date, scheduled_time, purpose, status, observer_name, indicators, facts, evidence, feedback_date, teacher_comment, agreements, next_review').eq('tenant_id', tenantId!).order('scheduled_date', { ascending: false }).limit(1000),
                supabase.from('visit_indicators').select('id, area, text, source, active').eq('tenant_id', tenantId!).order('created_at'),
            ])
            if (log.error) throw log.error
            if (visits.error) throw visits.error
            return { log: (log.data ?? []) as LogEntry[], visits: (visits.data ?? []) as Visit[], own: (ind.data ?? []) as OwnIndicator[] }
        },
    })

    if (!basics.isLoading && !basics.isLead) return <p role="alert" className="m-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm font-bold">La bitácora de la dirección es solo para la dirección y las coordinaciones.</p>
    if (isLoading || basics.isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    if (error || !data || !tenantId || !basics.data) return <p role="alert" className="m-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudo cargar la bitácora: {(error as Error | null)?.message ?? 'sin datos'}</p>

    const { students, groups, staff } = basics.data
    const ownIndicators: Indicator[] = data.own.filter(o => o.active).map(o => ({ id: o.id, area: o.area, text: o.text, source: o.source }))
    const visit = data.visits.find(v => v.id === visitId) ?? null
    const ctx = { tenantId, school: basics.schoolName, students, groups, staff, myName: basics.myName, print }
    const pendingFeedback = data.visits.filter(v => v.status === 'REALIZADA').length

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-5">
            {sheet}
            <div>
                <h1 className="text-3xl font-black text-slate-900">Bitácora de la dirección</h1>
                <p className="text-slate-600">Atención a familias, visitas de acompañamiento al aula y seguimiento. Solo la ven la dirección y las coordinaciones.</p>
            </div>
            <div role="tablist" className="flex flex-wrap gap-2">
                {([['log', `Atención y reuniones (${data.log.length})`, Users], ['visits', `Visitas al aula (${data.visits.length})${pendingFeedback ? ` · ${pendingFeedback} por retroalimentar` : ''}`, Eye], ['risk', 'Alumnos en riesgo', ShieldAlert], ['indicators', 'Indicadores de visita', ListChecks]] as const).map(([id, label, Icon]) => (
                    <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`${btn} ${tab === id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}><Icon className="w-4 h-4" /> {label}</button>
                ))}
            </div>

            {tab === 'log' && <LogTab log={data.log} students={students} groups={groups} staff={staff} onOpen={setEntry} />}
            {tab === 'visits' && <VisitsTab visits={data.visits} groups={groups} staff={staff} onOpen={setVisitId} onSchedule={() => setScheduling(true)} />}
            {tab === 'risk' && <RiskTab tenantId={tenantId} schoolYear={basics.data.schoolYear} students={students} groups={groups} log={data.log} onFollow={(s, reasons) => setEntry({ kind: 'SEGUIMIENTO_ALUMNO', student_id: s.id, subject: `Seguimiento a ${studentName(s)}`, facts: reasons })} />}
            {tab === 'indicators' && <IndicatorsTab tenantId={tenantId} own={data.own} onChanged={refresh} />}

            {entry && <EntryModal key={entry.id ?? 'new'} entry={entry} {...ctx} onClose={() => setEntry(null)} onSaved={() => { setEntry(null); refresh() }} />}
            {scheduling && <ScheduleModal tenantId={tenantId} groups={groups} staff={staff} own={ownIndicators} myName={basics.myName} onClose={() => setScheduling(false)} onSaved={id => { setScheduling(false); refresh(); setVisitId(id) }} />}
            {visit && <VisitModal key={visit.id} visit={visit} own={ownIndicators} {...ctx} onClose={() => setVisitId(null)} onChanged={refresh} />}
        </div>
    )
}

// ---------------------------------------------------------------- Atención y reuniones

const LogTab = ({ log, students, groups, staff, onOpen }: { log: LogEntry[]; students: BasicStudent[]; groups: BasicGroup[]; staff: BasicStaff[]; onOpen: (e: Partial<LogEntry>) => void }) => {
    const [kind, setKind] = useState('ALL')
    const [query, setQuery] = useState('')
    const shown = log.filter(e => (kind === 'ALL' || e.kind === kind) && matchesName(`${e.subject} ${e.attendees ?? ''} ${studentName(students.find(s => s.id === e.student_id))} ${staff.find(p => p.id === e.teacher_id)?.name ?? ''}`, query))
    const overdue = log.reduce((a, e) => a + agreementStats(asAgreements(e.agreements)).overdue, 0)
    return (
        <>
            <div className="flex flex-wrap gap-2">
                <input aria-label="Buscar" placeholder="Buscar por asunto, persona o alumno" value={query} onChange={e => setQuery(e.target.value)} className={`${input} flex-1 min-w-56`} />
                <select aria-label="Tipo de registro" value={kind} onChange={e => setKind(e.target.value)} className={input}><option value="ALL">Todos los registros</option>{Object.entries(LOG_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <button onClick={() => onOpen({ kind: 'REUNION_FAMILIA' })} className={primary}><Plus className="w-4 h-4" /> Nuevo registro</button>
            </div>
            {overdue > 0 && <p className="text-sm font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">Hay {overdue} acuerdo{overdue === 1 ? '' : 's'} con la fecha vencida y sin cumplir.</p>}
            {shown.length === 0 ? <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">{log.length ? 'Ningún registro coincide.' : 'Aún no hay registros. Anota aquí a quién se atendió y qué se acordó.'}</p> : (
                <ul className="space-y-2">
                    {shown.map(e => {
                        const st = students.find(s => s.id === e.student_id)
                        const ag = asAgreements(e.agreements)
                        return (
                            <li key={e.id}><button onClick={() => onOpen(e)} className="w-full text-left bg-white border border-slate-200 rounded-3xl p-4 flex flex-wrap items-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/30">
                                <span className="text-xs font-black bg-slate-900 text-white rounded-lg px-2 py-1 tabular-nums shrink-0">{folioLabel('DIR', e.folio)}</span>
                                <span className="min-w-0 flex-1 basis-56"><span className="block font-black text-slate-900 truncate">{e.subject}</span>
                                    <span className="block text-sm text-slate-600 truncate">{LOG_KIND[e.kind]} · {AREAS[e.area]}{st ? ` · ${studentName(st)} (${groupName(groups.find(g => g.id === st.group_id))})` : ''}{e.attendees ? ` · ${e.attendees}` : ''}</span></span>
                                <span className="text-xs font-bold text-slate-500 shrink-0">{new Date(e.occurred_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                                <span className={`text-xs font-black rounded-lg px-2 py-1 shrink-0 ${agreementStats(ag).overdue ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{agreementSummary(ag)}</span>
                                <span className={`text-xs font-black rounded-lg px-2 py-1 shrink-0 ${e.status === 'ABIERTO' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>{e.status === 'ABIERTO' ? 'En seguimiento' : 'Cerrado'}</span>
                            </button></li>
                        )
                    })}
                </ul>
            )}
        </>
    )
}

interface Ctx { tenantId: string; school: string; students: BasicStudent[]; groups: BasicGroup[]; staff: BasicStaff[]; myName: string; print: PrintFn }

const EntryModal = ({ entry, tenantId, school, students, groups, staff, myName, print, onClose, onSaved }: Ctx & { entry: Partial<LogEntry>; onClose: () => void; onSaved: () => void }) => {
    const d = entry.occurred_at ? new Date(entry.occurred_at) : new Date()
    const [kind, setKind] = useState(entry.kind ?? 'REUNION_FAMILIA')
    const [area, setArea] = useState(entry.area ?? 'DIRECCION')
    const [date, setDate] = useState(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    const [time, setTime] = useState(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    const [attendees, setAttendees] = useState(entry.attendees ?? '')
    const [studentId, setStudentId] = useState(entry.student_id ?? '')
    const [search, setSearch] = useState('')
    const [teacherId, setTeacherId] = useState(entry.teacher_id ?? '')
    const [subject, setSubject] = useState(entry.subject ?? '')
    const [facts, setFacts] = useState(entry.facts ?? '')
    const [agreements, setAgreements] = useState<Agreement[]>(asAgreements(entry.agreements))
    const [nextDate, setNextDate] = useState(entry.next_date ?? '')
    const [status, setStatus] = useState(entry.status ?? 'ABIERTO')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const chosen = students.find(s => s.id === studentId)
    const matches = search.trim().length >= 2 ? students.filter(s => matchesName(studentName(s), search)).slice(0, 6) : []
    const folio = folioLabel('DIR', entry.folio)

    const save = async () => {
        if (subject.trim().length < 4) return setMsg({ ok: false, text: 'Escribe el asunto.' })
        setBusy(true); setMsg(null)
        const row = { tenant_id: tenantId, kind, area, occurred_at: new Date(`${date}T${time || '00:00'}`).toISOString(), attendees: attendees.trim() || null, student_id: studentId || null, teacher_id: teacherId || null, subject: subject.trim(), facts: facts.trim() || null, agreements: cleanAgreements(agreements), next_date: nextDate || null, status }
        const { error } = entry.id ? await supabase.from('direction_log').update(row).eq('id', entry.id) : await supabase.from('direction_log').insert({ ...row, author_name: myName || null })
        setBusy(false)
        if (error) return setMsg({ ok: false, text: error.message })
        onSaved()
    }
    const sheet = (
        <div className="print-page">
            <SheetHeader school={school} title={`${LOG_KIND[kind]} · ${AREAS[area]}`} folio={entry.id ? folio : undefined} right={<p>{formatDateEs(date)} · {time} h</p>} />
            <SheetField label="Asunto" value={subject} />
            <SheetField label="Personas atendidas" value={attendees || '—'} />
            {chosen && <SheetField label="Alumna o alumno" value={`${studentName(chosen)} · ${groupName(groups.find(g => g.id === chosen.group_id))}`} />}
            {teacherId && <SheetField label="Docente" value={staff.find(p => p.id === teacherId)?.name} />}
            <SheetField label="Lo tratado (hechos)" value={facts || '—'} />
            <p className="text-[8.5pt] font-bold uppercase keep-caps tracking-wide mt-2">Acuerdos</p>
            <table className="w-full text-[10pt] border-collapse mb-2"><thead><tr className="text-left border-b border-black"><th className="py-1 w-[55%]">Acuerdo</th><th>Responsable</th><th>Fecha</th></tr></thead>
                <tbody>{(cleanAgreements(agreements).length ? cleanAgreements(agreements) : [{ id: 'a', text: '', responsible: '', due_date: null, done_at: null }, { id: 'b', text: '', responsible: '', due_date: null, done_at: null }]).map(a => <tr key={a.id} className="border-b border-black/40 h-[1.9em] align-top"><td className="pr-2">{a.text}</td><td className="pr-2">{a.responsible}</td><td>{a.due_date ? formatDateEs(a.due_date, true) : ''}</td></tr>)}</tbody></table>
            {nextDate && <SheetField label="Próxima reunión o revisión" value={formatDateEs(nextDate)} />}
            <SheetSignatures names={['Persona atendida', AREAS[area]]} />
        </div>
    )

    return (
        <Modal title={entry.id ? `${folio} · ${LOG_KIND[kind]}` : 'Nuevo registro'} sub={entry.id ? `Registró: ${entry.author_name ?? '—'}` : 'El folio se asigna al guardar.'} onClose={onClose}
            actions={<button onClick={() => print(sheet)} aria-label="Imprimir minuta" className="p-2 rounded-xl hover:bg-slate-100"><Printer className="w-5 h-5" /></button>}
            footer={<><button onClick={onClose} className={ghost}>Cancelar</button><button onClick={save} disabled={busy} className={primary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button></>}>
            <Notice msg={msg} />
            <div className="flex flex-wrap gap-2">
                <Label text="Tipo de registro" className="flex-1 min-w-48"><select value={kind} onChange={e => setKind(e.target.value)} className={`${input} w-full`}>{Object.entries(LOG_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Label>
                <Label text="Dónde se atendió"><select value={area} onChange={e => setArea(e.target.value)} className={input}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Label>
                <div><span className="block text-xs font-black text-slate-600 mb-1">Fecha</span><DateInput aria-label="Fecha" value={date} onChange={e => setDate(e.target.value)} className="w-48" /></div>
                <Label text="Hora"><input type="time" value={time} onChange={e => setTime(e.target.value)} className={input} /></Label>
            </div>
            <Label text="Asunto"><input value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} placeholder="Motivo de la reunión o de la atención" className={`${input} w-full`} /></Label>
            <Label text="A quiénes se atendió"><input value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="Nombre y parentesco o cargo de cada persona" className={`${input} w-full`} /></Label>
            <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-56">
                    <span className="block text-xs font-black text-slate-600 mb-1">Alumna o alumno (si aplica)</span>
                    {chosen ? <p className="flex items-center gap-2 border border-indigo-200 bg-indigo-50 rounded-xl px-3 min-h-11 text-sm font-black text-indigo-900">{studentName(chosen)} · {groupName(groups.find(g => g.id === chosen.group_id))}<button onClick={() => { setStudentId(''); setSearch('') }} className="ml-auto text-xs underline">Quitar</button></p> : (
                        <><input aria-label="Buscar alumno" value={search} onChange={e => setSearch(e.target.value)} placeholder="Escribe el nombre" className={`${input} w-full`} autoComplete="off" />
                            {matches.length > 0 && <ul className="mt-1 border border-slate-200 rounded-xl overflow-hidden">{matches.map(s => <li key={s.id}><button onClick={() => setStudentId(s.id)} className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-indigo-50">{studentName(s)} <span className="text-slate-500">· {groupName(groups.find(g => g.id === s.group_id))}</span></button></li>)}</ul>}</>
                    )}
                </div>
                <Label text="Docente (si aplica)" className="flex-1 min-w-48"><select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={`${input} w-full`}><option value="">Ninguno</option>{staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Label>
            </div>
            <Label text="Lo tratado"><textarea rows={4} value={facts} onChange={e => setFacts(e.target.value)} placeholder="Qué se expuso y qué se respondió, en hechos." className={`${input} w-full py-2 resize-y`} /><FactHint text={facts} /></Label>
            <div><span className="block text-xs font-black text-slate-600 mb-1">Acuerdos</span><AgreementsEditor value={agreements} onChange={setAgreements} responsibleHint="Responsable (familia, docente, dirección…)" /></div>
            <div className="flex flex-wrap gap-2">
                <div><span className="block text-xs font-black text-slate-600 mb-1">Próxima reunión o revisión</span><DateInput aria-label="Próxima fecha" value={nextDate} onChange={e => setNextDate(e.target.value)} className="w-48" /></div>
                <Label text="Estado"><select value={status} onChange={e => setStatus(e.target.value)} className={input}><option value="ABIERTO">En seguimiento</option><option value="CERRADO">Cerrado</option></select></Label>
            </div>
        </Modal>
    )
}

// ---------------------------------------------------------------- Visitas al aula

const VisitsTab = ({ visits, groups, staff, onOpen, onSchedule }: { visits: Visit[]; groups: BasicGroup[]; staff: BasicStaff[]; onOpen: (id: string) => void; onSchedule: () => void }) => {
    const teachers = staff.filter(p => p.roles.some(r => ['TEACHER', 'INDEPENDENT_TEACHER'].includes(r)))
    const without = teachers.filter(t => !visits.some(v => v.teacher_id === t.id))
    const tone: Record<string, string> = { PROGRAMADA: 'bg-slate-100 text-slate-700', REALIZADA: 'bg-amber-100 text-amber-800', RETROALIMENTADA: 'bg-indigo-50 text-indigo-700', CERRADA: 'bg-emerald-50 text-emerald-700' }
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600 flex-1 min-w-56">La visita es de acompañamiento: se programa con el docente, se registran hechos con indicadores y después se conversa para acordar siguientes pasos.</p>
                <button onClick={onSchedule} className={primary}><CalendarClock className="w-4 h-4" /> Programar visita</button>
            </div>
            {without.length > 0 && visits.length > 0 && <p className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">Docentes sin visita registrada ({without.length}): {without.map(t => t.name).join(', ')}.</p>}
            {visits.length === 0 ? <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">Aún no hay visitas. Programa la primera.</p> : (
                <ul className="space-y-2">
                    {visits.map(v => {
                        const s = visitSummary(asRecords(v.indicators))
                        return (
                            <li key={v.id}><button onClick={() => onOpen(v.id)} className="w-full text-left bg-white border border-slate-200 rounded-3xl p-4 flex flex-wrap items-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/30">
                                <span className="text-xs font-black bg-slate-900 text-white rounded-lg px-2 py-1 tabular-nums shrink-0">{folioLabel('VA', v.folio)}</span>
                                <span className="min-w-0 flex-1 basis-56"><span className="block font-black text-slate-900 truncate">{staff.find(p => p.id === v.teacher_id)?.name ?? 'Docente'}</span>
                                    <span className="block text-sm text-slate-600 truncate">{groupName(groups.find(g => g.id === v.group_id))}{v.subject ? ` · ${v.subject}` : ''} · {formatDateEs(v.scheduled_date, true)}{v.scheduled_time ? ` · ${v.scheduled_time.slice(0, 5)}` : ''}</span></span>
                                {s.filled > 0 && <span className="text-xs font-black rounded-lg px-2 py-1 bg-slate-100 text-slate-700 shrink-0">{s.filled} de {s.total} indicadores</span>}
                                <span className={`text-xs font-black rounded-lg px-2 py-1 shrink-0 ${tone[v.status]}`}>{VISIT_STATUS[v.status]}</span>
                            </button></li>
                        )
                    })}
                </ul>
            )}
        </>
    )
}

const ScheduleModal = ({ tenantId, groups, staff, own, myName, onClose, onSaved }: { tenantId: string; groups: BasicGroup[]; staff: BasicStaff[]; own: Indicator[]; myName: string; onClose: () => void; onSaved: (id: string) => void }) => {
    const [teacherId, setTeacherId] = useState('')
    const [groupId, setGroupId] = useState('')
    const [subject, setSubject] = useState('')
    const [date, setDate] = useState(today())
    const [time, setTime] = useState('')
    const [purpose, setPurpose] = useState('')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')
    const save = async () => {
        setBusy(true); setErr('')
        const { data, error } = await supabase.from('classroom_visits').insert({ tenant_id: tenantId, teacher_id: teacherId, group_id: groupId || null, subject: subject.trim() || null, scheduled_date: date, scheduled_time: time || null, purpose: purpose.trim() || null, observer_name: myName || null, indicators: blankRecords(own) }).select('id').single()
        setBusy(false)
        if (error || !data) return setErr(error?.message ?? 'No se pudo guardar.')
        onSaved(data.id as string)
    }
    return (
        <Modal title="Programar visita de acompañamiento" sub="Acuerda la fecha con el docente: es acompañamiento, no una visita sorpresa." onClose={onClose}
            footer={<><button onClick={onClose} className={ghost}>Cancelar</button><button onClick={save} disabled={busy || !teacherId || !date} className={primary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Programar</button></>}>
            {err && <Notice msg={{ ok: false, text: err }} />}
            <div className="flex flex-wrap gap-2">
                <Label text="Docente" className="flex-1 min-w-56"><select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={`${input} w-full`}><option value="">Elige…</option>{staff.filter(p => p.roles.some(r => ['TEACHER', 'INDEPENDENT_TEACHER'].includes(r))).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Label>
                <Label text="Grupo"><select value={groupId} onChange={e => setGroupId(e.target.value)} className={input}><option value="">Por definir</option>{groups.map(g => <option key={g.id} value={g.id}>{groupName(g)}</option>)}</select></Label>
                <Label text="Materia o proyecto" className="flex-1 min-w-48"><input value={subject} onChange={e => setSubject(e.target.value)} className={`${input} w-full`} /></Label>
            </div>
            <div className="flex flex-wrap gap-2">
                <div><span className="block text-xs font-black text-slate-600 mb-1">Fecha</span><DateInput aria-label="Fecha de la visita" value={date} onChange={e => setDate(e.target.value)} className="w-48" /></div>
                <Label text="Hora"><input type="time" value={time} onChange={e => setTime(e.target.value)} className={input} /></Label>
            </div>
            <Label text="Propósito de la visita"><textarea rows={2} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Qué se quiere acompañar, acordado con el docente" className={`${input} w-full py-2 resize-y`} /></Label>
            <p className="text-xs text-slate-500">La visita llevará {BASE_INDICATORS.length + own.length} indicadores: {BASE_INDICATORS.length} de base{own.length ? ` y ${own.length} de la escuela o la autoridad` : ''}.</p>
        </Modal>
    )
}

const V_SECTIONS = ['plan', 'record', 'feedback'] as const
const OBS: Observed[] = ['OBSERVADO', 'PARCIAL', 'NO_OBSERVADO', 'NO_APLICA']
const obsTone: Record<Observed, string> = { OBSERVADO: 'bg-emerald-600 text-white border-emerald-600', PARCIAL: 'bg-amber-500 text-white border-amber-500', NO_OBSERVADO: 'bg-slate-700 text-white border-slate-700', NO_APLICA: 'bg-slate-300 text-slate-800 border-slate-300' }

const VisitModal = ({ visit, own, tenantId, school, groups, staff, print, onClose, onChanged }: Ctx & { visit: Visit; own: Indicator[]; onClose: () => void; onChanged: () => void }) => {
    const acc = useAccordion(V_SECTIONS, visit.status === 'PROGRAMADA' ? 'record' : visit.status === 'REALIZADA' ? 'feedback' : null)
    const fold = (id: typeof V_SECTIONS[number]) => ({ open: acc.isOpen(id), onToggle: () => acc.toggle(id) })
    // Mientras no se haya realizado, la visita toma los indicadores que la escuela haya agregado después
    const [records, setRecords] = useState<IndicatorRecord[]>(() => {
        const saved = asRecords(visit.indicators)
        return visit.status === 'PROGRAMADA' ? [...saved, ...own.filter(o => !saved.some(s => s.id === o.id)).map(o => ({ ...o, observed: null, fact: '' }))] : saved
    })
    const [date, setDate] = useState(visit.scheduled_date)
    const [time, setTime] = useState(visit.scheduled_time?.slice(0, 5) ?? '')
    const [groupId, setGroupId] = useState(visit.group_id ?? '')
    const [subject, setSubject] = useState(visit.subject ?? '')
    const [purpose, setPurpose] = useState(visit.purpose ?? '')
    const [facts, setFacts] = useState(visit.facts ?? '')
    const [feedbackDate, setFeedbackDate] = useState(visit.feedback_date ?? '')
    const [comment, setComment] = useState(visit.teacher_comment ?? '')
    const [agreements, setAgreements] = useState<Agreement[]>(asAgreements(visit.agreements))
    const [nextReview, setNextReview] = useState(visit.next_review ?? '')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const teacher = staff.find(p => p.id === visit.teacher_id)?.name ?? 'Docente'
    const group = groups.find(g => g.id === groupId)
    const summary = visitSummary(records)
    const areas = [...new Set(records.map(r => r.area))]
    const folio = folioLabel('VA', visit.folio)
    const setRec = (id: string, patch: Partial<IndicatorRecord>) => setRecords(records.map(r => r.id === id ? { ...r, ...patch } : r))

    const update = async (patch: Record<string, unknown>, ok: string) => {
        setBusy(true); setMsg(null)
        const { error } = await supabase.from('classroom_visits').update(patch).eq('id', visit.id)
        setBusy(false)
        setMsg(error ? { ok: false, text: error.message } : { ok: true, text: ok })
        if (!error) onChanged()
    }
    const savePlan = () => update({ scheduled_date: date, scheduled_time: time || null, group_id: groupId || null, subject: subject.trim() || null, purpose: purpose.trim() || null }, 'Organización guardada.')
    const saveRecord = () => update({ indicators: records, facts: facts.trim() || null, ...(visit.status === 'PROGRAMADA' && summary.filled > 0 ? { status: 'REALIZADA' } : {}) }, summary.filled ? 'Registro de la visita guardado.' : 'Guardado. Aún no hay indicadores registrados.')
    const saveFeedback = (close = false) => {
        const clean = cleanAgreements(agreements); setAgreements(clean)
        if (!feedbackDate) return setMsg({ ok: false, text: 'Anota la fecha de la reunión con el docente.' })
        update({ feedback_date: feedbackDate, teacher_comment: comment.trim() || null, agreements: clean, next_review: nextReview || null, status: close ? 'CERRADA' : 'RETROALIMENTADA' }, close ? 'Visita cerrada.' : 'Retroalimentación guardada.')
    }

    const header = <SheetHeader school={school} title="Visita de acompañamiento al aula" folio={folio} right={<p>{formatDateEs(date)}{time ? ` · ${time} h` : ''}</p>} />
    const general = (
        <div className="grid grid-cols-3 gap-x-4">
            <SheetField label="Docente" value={teacher} /><SheetField label="Grupo" value={groupName(group)} /><SheetField label="Materia o proyecto" value={subject || '—'} />
            <div className="col-span-2"><SheetField label="Propósito de la visita" value={purpose || '—'} /></div><SheetField label="Quien acompaña" value={visit.observer_name || '—'} />
        </div>
    )
    const guide = (
        <div className="print-page">
            {header}{general}
            <p className="text-[9pt] mb-2">Marca lo que corresponda y anota el hecho: qué se vio o se oyó, quién, cuántos, en qué momento. Sin calificativos.</p>
            {areas.map(a => (
                <div key={a} className="mb-2">
                    <p className="text-[9.5pt] font-black border-b border-black">{a}</p>
                    <table className="w-full text-[9pt] border-collapse"><tbody>{records.filter(r => r.area === a).map(r => (
                        <tr key={r.id} className="border-b border-black/30 break-inside-avoid align-top"><td className="py-1 pr-2 w-[42%]">{r.text}{r.source === 'AUTORIDAD' ? ' (autoridad educativa)' : ''}</td>
                            <td className="w-[20%] text-[8pt] leading-tight">☐ Se observó<br />☐ En parte<br />☐ No se observó<br />☐ No correspondía</td><td className="border-l border-black/30 pl-1 text-[8pt] text-black/50">Hecho observado:</td></tr>))}</tbody></table>
                </div>
            ))}
            <SheetField label="Otros hechos observados" lines={3} />
        </div>
    )
    const report = (
        <div className="print-page">
            {header}{general}
            <p className="text-[9.5pt] mb-2"><b>Resumen:</b> de {summary.filled - summary.notApplicable} indicadores que correspondían a la sesión, {summary.observed} se observaron, {summary.partial} en parte y {summary.notObserved} no se observaron.</p>
            {areas.map(a => {
                const list = records.filter(r => r.area === a && r.observed)
                if (!list.length) return null
                return (
                    <div key={a} className="mb-2 break-inside-avoid">
                        <p className="text-[9.5pt] font-black border-b border-black">{a}</p>
                        {list.map(r => <p key={r.id} className="text-[9.5pt] border-b border-black/20 py-0.5"><b>{OBSERVED_LABEL[r.observed!]}:</b> {r.text}{r.fact.trim() ? <><br /><span className="pl-3">Hecho: {r.fact}</span></> : null}</p>)}
                    </div>
                )
            })}
            {facts.trim() && <SheetField label="Otros hechos observados" value={facts} />}
            <SheetField label="Lo que comenta el docente" value={comment || undefined} lines={3} />
            <p className="text-[8.5pt] font-bold uppercase keep-caps tracking-wide mt-2">Acuerdos y fechas de revisión</p>
            <table className="w-full text-[10pt] border-collapse mb-2"><thead><tr className="text-left border-b border-black"><th className="py-1 w-[55%]">Acuerdo</th><th>Responsable</th><th>Fecha de revisión</th></tr></thead>
                <tbody>{(cleanAgreements(agreements).length ? cleanAgreements(agreements) : ['a', 'b', 'c'].map(id => ({ id, text: '', responsible: '', due_date: null as string | null, done_at: null }))).map(a => <tr key={a.id} className="border-b border-black/40 h-[1.9em] align-top"><td className="pr-2">{a.text}</td><td className="pr-2">{a.responsible}</td><td>{a.due_date ? formatDateEs(a.due_date, true) : ''}</td></tr>)}</tbody></table>
            <SheetField label="Siguiente revisión" value={nextReview ? formatDateEs(nextReview) : undefined} />
            <SheetSignatures names={[teacher, visit.observer_name || 'Quien acompaña']} />
        </div>
    )

    return (
        <Modal title={`${folio} · ${teacher}`} sub={`${groupName(group)}${subject ? ` · ${subject}` : ''} · ${VISIT_STATUS[visit.status]}`} onClose={onClose}>
            <div className="flex flex-wrap items-center justify-between gap-2 -mt-1">
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => print(guide)} className={ghost}><Printer className="w-4 h-4" /> Guía de observación</button>
                    <button onClick={() => print(report)} disabled={!summary.filled} className={ghost}><ClipboardCheck className="w-4 h-4" /> Reporte para la reunión</button>
                </div>
                <AccordionToggleAll acc={acc} />
            </div>
            <Notice msg={msg} />

            <AccordionSection title="Organización" {...fold('plan')} summary={`${formatDateEs(date, true)}${time ? ` · ${time}` : ''} · ${groupName(group)}`}>
                <div className="flex flex-wrap gap-2">
                    <div><span className="block text-xs font-black text-slate-600 mb-1">Fecha</span><DateInput aria-label="Fecha de la visita" value={date} onChange={e => setDate(e.target.value)} className="w-48" /></div>
                    <Label text="Hora"><input type="time" value={time} onChange={e => setTime(e.target.value)} className={input} /></Label>
                    <Label text="Grupo"><select value={groupId} onChange={e => setGroupId(e.target.value)} className={input}><option value="">Por definir</option>{groups.map(g => <option key={g.id} value={g.id}>{groupName(g)}</option>)}</select></Label>
                    <Label text="Materia o proyecto" className="flex-1 min-w-40"><input value={subject} onChange={e => setSubject(e.target.value)} className={`${input} w-full`} /></Label>
                </div>
                <Label text="Propósito" className="mt-2"><textarea rows={2} value={purpose} onChange={e => setPurpose(e.target.value)} className={`${input} w-full py-2 resize-y`} /></Label>
                <button onClick={savePlan} disabled={busy} className={`${primary} mt-2`}>Guardar organización</button>
            </AccordionSection>

            <AccordionSection title="Registro de la visita" {...fold('record')} tone={summary.filled ? 'normal' : 'warn'} summary={summary.filled ? `${summary.observed} observados · ${summary.partial} en parte · ${summary.notObserved} no observados` : 'Sin registrar'}>
                <p className="text-sm text-slate-600 mb-3">En cada indicador marca qué pasó y anota el hecho que lo respalda. Se registran hechos, no opiniones: esa es la evidencia que se lleva a la conversación con el docente.</p>
                {areas.map(a => (
                    <fieldset key={a} className="mb-4">
                        <legend className="font-black text-slate-900 text-sm mb-2">{a}</legend>
                        <div className="space-y-3">
                            {records.filter(r => r.area === a).map(r => (
                                <div key={r.id} className="border border-slate-200 rounded-2xl p-3">
                                    <p className="text-sm font-bold text-slate-800">{r.text}{r.source !== 'BASE' && <span className="ml-2 text-xs font-black text-indigo-700">{r.source === 'AUTORIDAD' ? 'Autoridad educativa' : 'De la escuela'}</span>}</p>
                                    <div role="radiogroup" aria-label={r.text} className="flex flex-wrap gap-1.5 mt-2">
                                        {OBS.map(o => <button key={o} role="radio" aria-checked={r.observed === o} onClick={() => setRec(r.id, { observed: r.observed === o ? null : o })} className={`min-h-10 px-3 rounded-xl border text-xs font-black ${r.observed === o ? obsTone[o] : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{OBSERVED_LABEL[o]}</button>)}
                                    </div>
                                    {r.observed && r.observed !== 'NO_APLICA' && <><textarea aria-label={`Hecho observado: ${r.text}`} rows={2} value={r.fact} onChange={e => setRec(r.id, { fact: e.target.value })} placeholder="Hecho observado: qué se vio o se oyó" className={`${input} w-full py-2 mt-2 resize-y`} /><FactHint text={r.fact} /></>}
                                </div>
                            ))}
                        </div>
                    </fieldset>
                ))}
                <Label text="Otros hechos observados"><textarea rows={3} value={facts} onChange={e => setFacts(e.target.value)} className={`${input} w-full py-2 resize-y`} /><FactHint text={facts} /></Label>
                <div className="mt-3"><span className="block text-xs font-black text-slate-600 mb-1">Evidencias (pizarrón, productos, materiales)</span>
                    <EvidenceBox tenantId={tenantId} folder={`visitas/${visit.id}`} value={asEvidence(visit.evidence)} onChange={v => update({ evidence: v }, 'Evidencia guardada.')} /></div>
                <button onClick={saveRecord} disabled={busy} className={`${primary} mt-3`}>Guardar registro de la visita</button>
            </AccordionSection>

            <AccordionSection title="Retroalimentación con el docente" {...fold('feedback')} tone={visit.status === 'REALIZADA' ? 'warn' : 'normal'} summary={visit.feedback_date ? `${formatDateEs(visit.feedback_date, true)} · ${agreementSummary(agreements)}` : visit.status === 'REALIZADA' ? 'Pendiente de reunirse' : 'Después de la visita'}>
                {summary.filled > 0 && (
                    <div className="bg-slate-50 rounded-2xl p-3 mb-3">
                        <p className="text-xs font-black text-slate-600 mb-1">Para abrir la conversación (lo que quedó registrado)</p>
                        <ul className="text-sm text-slate-800 space-y-0.5">{summary.areas.map(a => <li key={a.area}><span className="font-black">{a.area}:</span> {a.observed} de {a.total} observados{a.partial ? `, ${a.partial} en parte` : ''}</li>)}</ul>
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    <div><span className="block text-xs font-black text-slate-600 mb-1">Fecha de la reunión</span><DateInput aria-label="Fecha de la reunión" value={feedbackDate} onChange={e => setFeedbackDate(e.target.value)} className="w-48" /></div>
                    <div><span className="block text-xs font-black text-slate-600 mb-1">Siguiente revisión</span><DateInput aria-label="Siguiente revisión" value={nextReview} onChange={e => setNextReview(e.target.value)} className="w-48" /></div>
                </div>
                <Label text="Lo que comenta el docente" className="mt-2"><textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Su lectura de la sesión, lo que necesita, lo que propone" className={`${input} w-full py-2 resize-y`} /></Label>
                <div className="mt-2"><span className="block text-xs font-black text-slate-600 mb-1">Acuerdos y fechas de revisión</span><AgreementsEditor value={agreements} onChange={setAgreements} responsibleHint="Responsable (docente, dirección, coordinación…)" /></div>
                <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => saveFeedback()} disabled={busy} className={primary}>Guardar retroalimentación</button>
                    {visit.status === 'RETROALIMENTADA' && <button onClick={() => saveFeedback(true)} disabled={busy} className={ghost}>Cerrar la visita</button>}
                </div>
            </AccordionSection>
        </Modal>
    )
}

// ---------------------------------------------------------------- Indicadores

const IndicatorsTab = ({ tenantId, own, onChanged }: { tenantId: string; own: OwnIndicator[]; onChanged: () => void }) => {
    const baseAreas = [...new Set(BASE_INDICATORS.map(i => i.area))]
    const [area, setArea] = useState(baseAreas[0])
    const [newArea, setNewArea] = useState('')
    const [text, setText] = useState('')
    const [source, setSource] = useState<'ESCUELA' | 'AUTORIDAD'>('AUTORIDAD')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')
    const areaName = area === '__new' ? newArea.trim() : area
    const add = async () => {
        setBusy(true); setErr('')
        const { error } = await supabase.from('visit_indicators').insert({ tenant_id: tenantId, area: areaName, text: text.trim(), source })
        setBusy(false)
        if (error) return setErr(error.message)
        setText(''); onChanged()
    }
    const toggle = async (id: string, active: boolean) => { await supabase.from('visit_indicators').update({ active }).eq('id', id); onChanged() }
    const areas = [...new Set([...baseAreas, ...own.map(o => o.area)])]
    return (
        <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-2">
                <h2 className="font-black text-slate-900">Agregar un indicador</h2>
                <p className="text-sm text-slate-600">Redáctalo como algo que se pueda ver u oír en el aula («Se usa…», «Las y los alumnos…»). Se sumará a las visitas que programes a partir de ahora y a las que aún no se realizan.</p>
                <div className="flex flex-wrap gap-2">
                    <select aria-label="Ámbito" value={area} onChange={e => setArea(e.target.value)} className={input}>{areas.map(a => <option key={a} value={a}>{a}</option>)}<option value="__new">Otro ámbito…</option></select>
                    {area === '__new' && <input aria-label="Nombre del ámbito" value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="Nombre del ámbito" className={`${input} flex-1 min-w-44`} />}
                    <select aria-label="Quién lo pide" value={source} onChange={e => setSource(e.target.value as typeof source)} className={input}><option value="AUTORIDAD">Lo pide la autoridad educativa</option><option value="ESCUELA">Lo define la escuela</option></select>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input aria-label="Indicador" value={text} onChange={e => setText(e.target.value)} placeholder="Indicador observable" maxLength={240} className={`${input} flex-1 min-w-56`} />
                    <button onClick={add} disabled={busy || text.trim().length < 8 || areaName.length < 3} className={primary}><Plus className="w-4 h-4" /> Agregar</button>
                </div>
                <FactHint text={text} />
                {err && <p role="alert" className="text-sm font-bold text-rose-700">{err}</p>}
            </div>
            {areas.map(a => (
                <section key={a} className="bg-white border border-slate-200 rounded-3xl p-4">
                    <h2 className="font-black text-slate-900 mb-2">{a}</h2>
                    <ul className="divide-y divide-slate-100">
                        {BASE_INDICATORS.filter(i => i.area === a).map(i => <li key={i.id} className="py-2 text-sm text-slate-800">{i.text}</li>)}
                        {own.filter(o => o.area === a).map(o => (
                            <li key={o.id} className={`py-2 flex flex-wrap items-center gap-2 ${o.active ? '' : 'opacity-50'}`}>
                                <span className="flex-1 min-w-56 text-sm text-slate-800">{o.text} <span className="text-xs font-black text-indigo-700">{o.source === 'AUTORIDAD' ? 'Autoridad educativa' : 'De la escuela'}</span></span>
                                <button onClick={() => toggle(o.id, !o.active)} className="text-xs font-black text-indigo-700 underline min-h-9">{o.active ? 'Dejar de usar' : 'Volver a usar'}</button>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    )
}

// ---------------------------------------------------------------- Alumnos en riesgo

const RISK_LABEL: Record<string, string> = { ACADEMICO: 'Reprobación', CONDUCTA: 'Conducta', ASISTENCIA: 'Inasistencias', SOCIOEMOCIONAL: 'Socioemocional', DIAGNOSTICO: 'Diagnóstico' }
const riskTone: Record<string, string> = { ACADEMICO: 'bg-rose-100 text-rose-800', CONDUCTA: 'bg-amber-100 text-amber-800', ASISTENCIA: 'bg-slate-200 text-slate-800', SOCIOEMOCIONAL: 'bg-indigo-100 text-indigo-800', DIAGNOSTICO: 'bg-sky-100 text-sky-800' }

const RiskTab = ({ tenantId, schoolYear, students, groups, log, onFollow }: { tenantId: string; schoolYear: string; students: BasicStudent[]; groups: BasicGroup[]; log: LogEntry[]; onFollow: (s: BasicStudent, reasons: string) => void }) => {
    const [groupId, setGroupId] = useState('')
    const [kind, setKind] = useState('ALL')
    const { data, isLoading, error } = useQuery({
        queryKey: ['students-at-risk', tenantId, schoolYear],
        queryFn: async () => {
            const [risk, inst] = await Promise.all([
                supabase.rpc('students_at_risk'),
                supabase.from('school_instruments').select('id, kind, items').eq('tenant_id', tenantId).eq('school_year', schoolYear).neq('status', 'DRAFT'),
            ])
            if (risk.error) throw risk.error
            const instruments = (inst.data ?? []) as { id: string; kind: InstrumentKind; items: Item[] }[]
            const socio: Record<string, string[]> = {}, diag: Record<string, string[]> = {}
            if (instruments.length) {
                for (let from = 0; from < 20_000; from += 1000) {
                    const { data: page, error: e } = await supabase.from('instrument_results').select('instrument_id, student_id, answers, absent').in('instrument_id', instruments.map(i => i.id)).range(from, from + 999)
                    if (e) throw e
                    for (const r of (page ?? []) as { instrument_id: string; student_id: string; answers: Answers; absent: boolean }[]) {
                        const i = instruments.find(x => x.id === r.instrument_id)
                        if (!i || r.absent) continue
                        const low = scoreStudent(i.kind, Array.isArray(i.items) ? i.items : [], r.answers)?.byTopic.filter(t => t.level === 'APOYO').map(t => t.topic) ?? []
                        if (!low.length) continue
                        const target = i.kind === 'SOCIOEMOCIONAL' ? socio : diag
                        target[r.student_id] = [...new Set([...(target[r.student_id] ?? []), ...low])]
                    }
                    if (!page || page.length < 1000) break
                }
            }
            return buildRiskCases((risk.data ?? []) as RiskRow[], socio, diag)
        },
    })
    const cases = useMemo(() => (data ?? []).map(c => ({ ...c, student: students.find(s => s.id === c.studentId) }))
        .filter((c): c is typeof c & { student: BasicStudent } => !!c.student && c.student.status !== 'INACTIVE')
        .filter(c => (!groupId || c.student.group_id === groupId) && (kind === 'ALL' || c.reasons.some(r => r.kind === kind))), [data, students, groupId, kind])

    if (isLoading) return <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
    if (error) return <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudo calcular: {(error as Error).message}</p>
    return (
        <>
            <p className="text-sm text-slate-600">Se detecta con lo que ya está en el sistema: promedio reprobatorio por materia, tres o más incidencias de conducta en 60 días o una grave en seguimiento, cuatro o más faltas en 30 días, y «requiere apoyo» en la encuesta socioemocional o en el diagnóstico. Es una señal para acercarse, no una etiqueta.</p>
            <div className="flex flex-wrap gap-2">
                <select aria-label="Grupo" value={groupId} onChange={e => setGroupId(e.target.value)} className={input}><option value="">Toda la escuela</option>{groups.map(g => <option key={g.id} value={g.id}>{groupName(g)}</option>)}</select>
                <select aria-label="Señal" value={kind} onChange={e => setKind(e.target.value)} className={input}><option value="ALL">Todas las señales</option>{Object.entries(RISK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <span className="self-center text-sm font-black text-slate-700">{cases.length} alumno{cases.length === 1 ? '' : 's'}</span>
            </div>
            {cases.length === 0 ? <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">No hay alumnos con señales de riesgo con estos filtros.</p> : (
                <ul className="space-y-2">
                    {cases.map(c => {
                        const follow = log.find(e => e.student_id === c.studentId && e.kind === 'SEGUIMIENTO_ALUMNO')
                        return (
                            <li key={c.studentId} className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-wrap items-start gap-3">
                                <div className="min-w-0 flex-1 basis-64">
                                    <p className="font-black text-slate-900">{studentName(c.student)} <span className="font-bold text-slate-500">· {groupName(groups.find(g => g.id === c.student.group_id))}</span></p>
                                    <div className="flex flex-wrap gap-1.5 my-1.5">{c.reasons.map(r => <span key={r.kind} className={`text-xs font-black rounded-lg px-2 py-1 ${riskTone[r.kind]}`}>{RISK_LABEL[r.kind]}</span>)}</div>
                                    <ul className="text-sm text-slate-700 list-disc pl-5">{c.reasons.map(r => <li key={r.kind}>{r.text}</li>)}</ul>
                                </div>
                                {follow ? <span className="text-xs font-black rounded-lg px-2 py-1 bg-emerald-50 text-emerald-800">En seguimiento desde el {new Date(follow.occurred_at).toLocaleDateString('es-MX')} ({folioLabel('DIR', follow.folio)})</span>
                                    : <button onClick={() => onFollow(c.student, c.reasons.map(r => `• ${r.text}`).join('\n'))} className={`${btn} bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}><Plus className="w-4 h-4" /> Abrir seguimiento</button>}
                            </li>
                        )
                    })}
                </ul>
            )}
        </>
    )
}
