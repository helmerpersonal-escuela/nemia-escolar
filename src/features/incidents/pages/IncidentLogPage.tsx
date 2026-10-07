import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BookOpen, CheckCircle2, FileStack, Loader2, Plus, Printer, Search, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { groupName, studentName, useSchoolBasics, type BasicGroup, type BasicStudent } from '../../../hooks/useSchoolBasics'
import { AccordionSection, AccordionToggleAll, useAccordion } from '../../../components/ui/Accordion'
import { AgreementsEditor } from '../../../components/ui/AgreementsEditor'
import { EvidenceBox, asEvidence, type EvidenceFile } from '../../../components/ui/EvidenceBox'
import { DateInput, formatDateEs } from '../../../components/ui/DateInput'
import { SheetField, SheetHeader, SheetSignatures, usePrint } from '../../../components/ui/PrintSheet'
import { agreementSummary, asAgreements, cleanAgreements, folioLabel, type Agreement } from '../../../lib/agreements'
import { matchesName } from '../../students/lib/studentReport'
import { PROGRESS_LABEL, SEVERITY_LABEL, STATUS_LABEL, TYPE_LABEL, mergeCatalog, type CatalogItem, type IncidentType, type Severity } from '../lib/catalog'

interface Incident {
    id: string; folio: number | null; student_id: string; teacher_id: string | null; type: IncidentType; severity: Severity
    title: string | null; description: string | null; action_taken: string | null; status: string
    occurred_at: string | null; created_at: string; place: string | null; involved: string | null; catalog_item: string | null
    agreements: unknown; evidence: unknown
}
interface Followup { id: string; note: string; progress: string; author_name: string | null; created_at: string }
interface BlankFolio { folio: number; reserved_at: string; incident_id: string | null }

const input = 'min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:border-indigo-400 outline-none'
const btn = 'inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-black disabled:opacity-50'
const sevTone: Record<Severity, string> = { BAJA: 'bg-slate-100 text-slate-700', MEDIA: 'bg-amber-100 text-amber-800', ALTA: 'bg-rose-100 text-rose-800' }
const when = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const INC = (f: number | null) => folioLabel('INC', f)
const KEY = 'incident-log'

export const IncidentLogPage = () => {
    const basics = useSchoolBasics()
    const { tenantId, role } = basics
    const qc = useQueryClient()
    const refresh = () => qc.invalidateQueries({ queryKey: [KEY] })
    const { sheet, print } = usePrint()
    const [tab, setTab] = useState<'log' | 'catalog' | 'sheets'>('log')
    const [query, setQuery] = useState('')
    const [type, setType] = useState<'ALL' | IncidentType>('ALL')
    const [status, setStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL')
    const [openId, setOpenId] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)

    const { data, isLoading, error } = useQuery({
        queryKey: [KEY, tenantId],
        enabled: !!tenantId,
        queryFn: async () => {
            const [inc, cat, blanks] = await Promise.all([
                supabase.from('student_incidents').select('id, folio, student_id, teacher_id, type, severity, title, description, action_taken, status, occurred_at, created_at, place, involved, catalog_item, agreements, evidence')
                    .eq('tenant_id', tenantId!).order('folio', { ascending: false }).limit(1000),
                supabase.from('incident_catalog').select('id, name, type, severity, measure, active').eq('tenant_id', tenantId!).order('name'),
                supabase.from('incident_blank_folios').select('folio, reserved_at, incident_id').eq('tenant_id', tenantId!).order('folio', { ascending: false }).limit(200),
            ])
            if (inc.error) throw inc.error
            return {
                incidents: (inc.data ?? []) as Incident[],
                ownCatalog: (cat.data ?? []) as (CatalogItem & { id: string; active: boolean })[],
                blanks: (blanks.data ?? []) as BlankFolio[],
            }
        },
    })

    const students = useMemo(() => basics.data?.students ?? [], [basics.data])
    const groups = basics.data?.groups ?? []
    const studentOf = (id: string) => students.find(s => s.id === id)
    const groupOf = (s?: BasicStudent) => groups.find(g => g.id === s?.group_id)
    const staffName = (id: string | null) => basics.data?.staff.find(p => p.id === id)?.name ?? ''
    const catalog = useMemo(() => mergeCatalog((data?.ownCatalog ?? []).filter(c => c.active)), [data])
    const canManageCatalog = basics.isLead || role === 'PREFECT'

    const shown = useMemo(() => (data?.incidents ?? []).filter(i => {
        if (type !== 'ALL' && i.type !== type) return false
        if (status === 'OPEN' && i.status !== 'OPEN') return false
        if (status === 'RESOLVED' && i.status === 'OPEN') return false
        const q = query.trim()
        if (!q) return true
        const s = students.find(x => x.id === i.student_id)
        return matchesName(`${studentName(s)} ${i.catalog_item ?? ''} ${i.title ?? ''} ${i.description ?? ''} ${INC(i.folio)}`, q)
    }), [data, students, type, status, query])

    if (isLoading || basics.isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    if (error || !data || !tenantId) return <p role="alert" className="m-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudo cargar la bitácora: {(error as Error | null)?.message ?? 'sin datos'}</p>

    const opened = data.incidents.find(i => i.id === openId) ?? null
    const open = data.incidents.filter(i => i.status === 'OPEN').length
    const printLog = () => print(
        <div className="print-page">
            <SheetHeader school={basics.schoolName} title="Bitácora de incidencias" right={<p>{formatDateEs(new Date().toISOString().slice(0, 10))}<br />{shown.length} registros</p>} />
            <table className="w-full text-[9pt] border-collapse">
                <thead><tr className="text-left border-b border-black">{['Folio', 'Fecha', 'Alumno', 'Grupo', 'Incidencia', 'Gravedad', 'Estado', 'Acuerdos'].map(h => <th key={h} className="py-1 pr-2">{h}</th>)}</tr></thead>
                <tbody>{shown.map(i => { const s = studentOf(i.student_id); return (
                    <tr key={i.id} className="border-b border-black/30 align-top">
                        <td className="py-1 pr-2 font-bold whitespace-nowrap">{INC(i.folio)}</td><td className="pr-2 whitespace-nowrap">{new Date(i.occurred_at ?? i.created_at).toLocaleDateString('es-MX')}</td>
                        <td className="pr-2">{studentName(s)}</td><td className="pr-2 whitespace-nowrap">{groupName(groupOf(s))}</td>
                        <td className="pr-2">{i.catalog_item || i.title || TYPE_LABEL[i.type]}</td><td className="pr-2">{SEVERITY_LABEL[i.severity]}</td><td className="pr-2">{STATUS_LABEL[i.status] ?? i.status}</td><td>{agreementSummary(asAgreements(i.agreements))}</td>
                    </tr>) })}</tbody>
            </table>
        </div>)

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-5">
            {sheet}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Bitácora de incidencias</h1>
                    <p className="text-slate-600">Cada registro lleva folio consecutivo, relato, medidas, acuerdos, avances y evidencias.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={printLog} className={`${btn} bg-white border border-slate-200 text-slate-700 hover:bg-slate-50`}><Printer className="w-4 h-4" /> Imprimir lista</button>
                    <button onClick={() => setCreating(true)} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}><Plus className="w-4 h-4" /> Registrar incidencia</button>
                </div>
            </div>

            <div role="tablist" className="flex flex-wrap gap-2">
                {([['log', `Registros (${data.incidents.length})`, BookOpen], ['catalog', 'Catálogo de incidencias', FileStack], ['sheets', 'Hojas prefoliadas', Printer]] as const).map(([id, label, Icon]) => (
                    <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`${btn} ${tab === id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}><Icon className="w-4 h-4" /> {label}</button>
                ))}
            </div>

            {tab === 'log' && (
                <>
                    <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input aria-label="Buscar" placeholder="Buscar por alumno, folio o incidencia" value={query} onChange={e => setQuery(e.target.value)} className={`${input} w-full pl-9`} />
                        </div>
                        <select aria-label="Tipo" value={type} onChange={e => setType(e.target.value as typeof type)} className={input}>
                            <option value="ALL">Todos los tipos</option>
                            {(Object.keys(TYPE_LABEL) as IncidentType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                        </select>
                        <select aria-label="Estado" value={status} onChange={e => setStatus(e.target.value as typeof status)} className={input}>
                            <option value="ALL">Todas ({data.incidents.length})</option>
                            <option value="OPEN">En seguimiento ({open})</option>
                            <option value="RESOLVED">Atendidas ({data.incidents.length - open})</option>
                        </select>
                    </div>
                    {shown.length === 0 ? <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">{data.incidents.length ? 'Ningún registro coincide con la búsqueda.' : 'Todavía no hay incidencias registradas.'}</p> : (
                        <ul className="space-y-2">
                            {shown.map(i => {
                                const s = studentOf(i.student_id)
                                return (
                                    <li key={i.id}>
                                        <button onClick={() => setOpenId(i.id)} className="w-full text-left bg-white border border-slate-200 rounded-3xl p-4 flex flex-wrap items-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/30">
                                            <span className="text-xs font-black bg-slate-900 text-white rounded-lg px-2 py-1 tabular-nums shrink-0">{INC(i.folio)}</span>
                                            <span className="min-w-0 flex-1 basis-56">
                                                <span className="block font-black text-slate-900 truncate">{studentName(s)} <span className="font-bold text-slate-500">· {groupName(groupOf(s))}</span></span>
                                                <span className="block text-sm text-slate-600 truncate">{i.catalog_item || i.title || i.description}</span>
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 shrink-0">{new Date(i.occurred_at ?? i.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                                            <span className={`text-xs font-black rounded-lg px-2 py-1 shrink-0 ${sevTone[i.severity]}`}>{TYPE_LABEL[i.type]} · {SEVERITY_LABEL[i.severity]}</span>
                                            <span className={`text-xs font-black rounded-lg px-2 py-1 shrink-0 ${i.status === 'OPEN' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>{STATUS_LABEL[i.status] ?? i.status}</span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </>
            )}

            {tab === 'catalog' && <CatalogTab tenantId={tenantId} catalog={mergeCatalog(data.ownCatalog)} own={data.ownCatalog} canManage={canManageCatalog} onChanged={refresh} />}
            {tab === 'sheets' && <SheetsTab school={basics.schoolName} blanks={data.blanks} incidents={data.incidents} onChanged={refresh} print={print} />}

            {creating && <NewIncident tenantId={tenantId} myId={basics.myId} students={students} groups={groups} catalog={catalog} blanks={data.blanks.filter(b => !b.incident_id)} onClose={() => setCreating(false)} onSaved={id => { setCreating(false); refresh(); setOpenId(id) }} />}
            {opened && <IncidentPanel key={opened.id} incident={opened} tenantId={tenantId} school={basics.schoolName} student={studentOf(opened.student_id)} group={groupOf(studentOf(opened.student_id))} author={staffName(opened.teacher_id)} myName={basics.myName} onClose={() => setOpenId(null)} onChanged={refresh} print={print} />}
        </div>
    )
}

// ---------------------------------------------------------------- Hoja impresa

const IncidentSheet = ({ school, incident, student, group, author, followups }: { school: string; incident: Partial<Incident>; student?: BasicStudent; group?: BasicGroup; author?: string; followups?: Followup[] }) => {
    const blank = !incident.id
    const agreements = asAgreements(incident.agreements)
    return (
        <div className="print-page">
            <SheetHeader school={school} title="Reporte de incidencia" folio={INC(incident.folio ?? null)} />
            <div className="grid grid-cols-3 gap-x-4">
                <div className="col-span-2"><SheetField label="Alumna o alumno" value={blank ? undefined : studentName(student)} /></div>
                <SheetField label="Grado y grupo" value={blank ? undefined : groupName(group)} />
                <SheetField label="Fecha y hora" value={blank ? undefined : when(incident.occurred_at ?? incident.created_at)} />
                <SheetField label="Lugar" value={blank ? undefined : incident.place || '—'} />
                <SheetField label="Registró" value={blank ? undefined : author || '—'} />
                <div className="col-span-2"><SheetField label="Incidencia (según el catálogo)" value={blank ? undefined : incident.catalog_item || incident.title || '—'} /></div>
                <SheetField label="Tipo y gravedad" value={blank ? undefined : `${TYPE_LABEL[incident.type!]} · ${SEVERITY_LABEL[incident.severity!]}`} />
            </div>
            <SheetField label="Relato de los acontecimientos (qué pasó, en el orden en que pasó)" value={blank ? undefined : incident.description || '—'} lines={7} />
            <SheetField label="Personas involucradas o que presenciaron" value={blank ? undefined : incident.involved || '—'} lines={2} />
            <SheetField label="Medidas tomadas" value={blank ? undefined : incident.action_taken || '—'} lines={4} />
            <div className="mb-2">
                <p className="text-[8.5pt] font-bold uppercase keep-caps tracking-wide">Pactos y acuerdos</p>
                <table className="w-full text-[10pt] border-collapse">
                    <thead><tr className="text-left border-b border-black"><th className="py-1 w-[55%]">Acuerdo</th><th>Responsable</th><th>Fecha de revisión</th><th>Cumplido</th></tr></thead>
                    <tbody>
                        {(blank || !agreements.length ? Array.from({ length: 4 }, (_, i): Agreement => ({ id: String(i), text: '', responsible: '', due_date: null, done_at: null })) : agreements).map(a => (
                            <tr key={a.id} className="border-b border-black/40 h-[1.9em] align-top"><td className="pr-2">{a.text}</td><td className="pr-2">{a.responsible}</td><td>{a.due_date ? formatDateEs(a.due_date, true) : ''}</td><td>{a.done_at ? formatDateEs(a.done_at, true) : ''}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!blank && !!followups?.length && (
                <div className="mb-2">
                    <p className="text-[8.5pt] font-bold uppercase keep-caps tracking-wide">Control de avances</p>
                    {followups.map(f => <p key={f.id} className="text-[10pt] border-b border-black/30 py-0.5"><b>{new Date(f.created_at).toLocaleDateString('es-MX')} · {PROGRESS_LABEL[f.progress]}:</b> {f.note}{f.author_name ? ` (${f.author_name})` : ''}</p>)}
                </div>
            )}
            {blank && <SheetField label="Control de avances (fecha y avance)" lines={3} />}
            <SheetSignatures names={['Alumna o alumno', 'Madre, padre o tutor', 'Quien registra', 'Dirección']} />
            {blank && <p className="text-[8pt] mt-3">Hoja prefoliada. Al capturarla en VUNLEK elige el folio {INC(incident.folio ?? null)} para que conserve su número.</p>}
        </div>
    )
}

// ---------------------------------------------------------------- Registro nuevo

const NewIncident = ({ tenantId, myId, students, groups, catalog, blanks, onClose, onSaved }: { tenantId: string; myId?: string; students: BasicStudent[]; groups: BasicGroup[]; catalog: CatalogItem[]; blanks: BlankFolio[]; onClose: () => void; onSaved: (id: string) => void }) => {
    const now = new Date()
    const [search, setSearch] = useState('')
    const [studentId, setStudentId] = useState('')
    const [date, setDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    const [time, setTime] = useState(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    const [item, setItem] = useState('')
    const [other, setOther] = useState('')
    const [type, setType] = useState<IncidentType>('CONDUCTA')
    const [severity, setSeverity] = useState<Severity>('BAJA')
    const [place, setPlace] = useState('')
    const [involved, setInvolved] = useState('')
    const [description, setDescription] = useState('')
    const [measure, setMeasure] = useState('')
    const [folio, setFolio] = useState('')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')

    const matches = search.trim().length >= 2 ? students.filter(s => s.status !== 'INACTIVE' && matchesName(studentName(s), search)).slice(0, 8) : []
    const chosen = students.find(s => s.id === studentId)
    const pick = (name: string) => {
        setItem(name)
        const c = catalog.find(x => x.name === name)
        if (c) { setType(c.type); setSeverity(c.severity); if (!measure.trim()) setMeasure(c.measure ?? '') }
    }
    const name = item === '__other' ? other.trim() : item
    const ready = !!studentId && !!name && description.trim().length >= 10

    const save = async () => {
        setErr(''); setBusy(true)
        const { data, error } = await supabase.from('student_incidents').insert({
            tenant_id: tenantId, student_id: studentId, teacher_id: myId ?? null, type, severity, title: name, catalog_item: name,
            description: description.trim(), action_taken: measure.trim() || null, place: place.trim() || null, involved: involved.trim() || null,
            occurred_at: new Date(`${date}T${time || '00:00'}`).toISOString(), status: 'OPEN', ...(folio ? { folio: Number(folio) } : {}),
        }).select('id').single()
        setBusy(false)
        if (error || !data) return setErr(error?.message ?? 'No se pudo guardar.')
        onSaved(data.id as string)
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="ni-title" onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] flex flex-col">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                    <h2 id="ni-title" className="text-xl font-black text-slate-900">Registrar incidencia</h2>
                    <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-black text-slate-600 mb-1" htmlFor="ni-student">Alumna o alumno</label>
                        {chosen ? (
                            <p className="flex items-center gap-2 border border-indigo-200 bg-indigo-50 rounded-xl px-3 min-h-11 text-sm font-black text-indigo-900">{studentName(chosen)} · {groupName(groups.find(g => g.id === chosen.group_id))}
                                <button onClick={() => { setStudentId(''); setSearch('') }} className="ml-auto text-xs font-black underline">Cambiar</button></p>
                        ) : (
                            <>
                                <input id="ni-student" value={search} onChange={e => setSearch(e.target.value)} placeholder="Escribe el nombre o apellido" className={`${input} w-full`} autoComplete="off" />
                                {matches.length > 0 && <ul className="mt-1 border border-slate-200 rounded-xl overflow-hidden">{matches.map(s => (
                                    <li key={s.id}><button onClick={() => setStudentId(s.id)} className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-indigo-50">{studentName(s)} <span className="text-slate-500">· {groupName(groups.find(g => g.id === s.group_id))}</span></button></li>))}</ul>}
                            </>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div><span className="block text-xs font-black text-slate-600 mb-1">Fecha</span><DateInput aria-label="Fecha" value={date} max={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} className="w-48" /></div>
                        <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Hora</span><input type="time" value={time} onChange={e => setTime(e.target.value)} className={input} /></label>
                        <label className="block flex-1 min-w-40"><span className="block text-xs font-black text-slate-600 mb-1">Lugar</span><input value={place} onChange={e => setPlace(e.target.value)} placeholder="Salón, patio, entrada…" className={`${input} w-full`} /></label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <label className="block flex-1 min-w-56"><span className="block text-xs font-black text-slate-600 mb-1">Incidencia (catálogo)</span>
                            <select value={item} onChange={e => pick(e.target.value)} className={`${input} w-full`}>
                                <option value="">Elige…</option>
                                {(Object.keys(TYPE_LABEL) as IncidentType[]).map(t => <optgroup key={t} label={TYPE_LABEL[t]}>{catalog.filter(c => c.type === t).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</optgroup>)}
                                <option value="__other">Otra, no está en el catálogo…</option>
                            </select></label>
                        <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Tipo</span><select value={type} onChange={e => setType(e.target.value as IncidentType)} className={input}>{(Object.keys(TYPE_LABEL) as IncidentType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
                        <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Gravedad</span><select value={severity} onChange={e => setSeverity(e.target.value as Severity)} className={input}>{(Object.keys(SEVERITY_LABEL) as Severity[]).map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}</select></label>
                    </div>
                    {item === '__other' && <input aria-label="Nombre de la incidencia" value={other} onChange={e => setOther(e.target.value)} placeholder="Describe la incidencia en pocas palabras" maxLength={120} className={`${input} w-full`} />}
                    <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Relato de los acontecimientos</span>
                        <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Qué pasó, en el orden en que pasó. Escribe lo que se vio y se oyó, sin calificar a nadie." className={`${input} w-full py-2 resize-y`} />
                        <span className="text-xs text-slate-500">El relato ya no se podrá cambiar después de guardar; lo que ocurra después se anota en «Control de avances».</span></label>
                    <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Personas involucradas o que lo presenciaron</span><input value={involved} onChange={e => setInvolved(e.target.value)} className={`${input} w-full`} /></label>
                    <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Medidas tomadas</span><textarea rows={2} value={measure} onChange={e => setMeasure(e.target.value)} placeholder="Qué se hizo en el momento" className={`${input} w-full py-2 resize-y`} /></label>
                    {blanks.length > 0 && (
                        <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">¿Vienes de una hoja prefoliada impresa?</span>
                            <select value={folio} onChange={e => setFolio(e.target.value)} className={`${input} w-full`}>
                                <option value="">No, asignar el siguiente folio</option>
                                {[...blanks].reverse().map(b => <option key={b.folio} value={b.folio}>Sí, es la hoja {INC(b.folio)}</option>)}
                            </select></label>
                    )}
                    {err && <p role="alert" className="flex items-start gap-2 text-sm font-bold rounded-2xl px-4 py-3 bg-rose-50 text-rose-800"><AlertTriangle className="w-4 h-4 mt-0.5" />{err}</p>}
                </div>
                <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
                    <button onClick={onClose} className={`${btn} bg-white border border-slate-200 text-slate-700`}>Cancelar</button>
                    <button onClick={save} disabled={!ready || busy} className={`${btn} bg-indigo-600 text-white`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar con folio</button>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- Un registro

const SECTIONS = ['story', 'measures', 'agreements', 'progress', 'evidence'] as const
type PrintFn = (node: React.ReactNode) => void

const IncidentPanel = ({ incident, tenantId, school, student, group, author, myName, onClose, onChanged, print }: { incident: Incident; tenantId: string; school: string; student?: BasicStudent; group?: BasicGroup; author: string; myName: string; onClose: () => void; onChanged: () => void; print: PrintFn }) => {
    const acc = useAccordion(SECTIONS)
    const fold = (id: typeof SECTIONS[number]) => ({ open: acc.isOpen(id), onToggle: () => acc.toggle(id) })
    const qc = useQueryClient()
    const [measures, setMeasures] = useState(incident.action_taken ?? '')
    const [agreements, setAgreements] = useState<Agreement[]>(asAgreements(incident.agreements))
    const [note, setNote] = useState('')
    const [progress, setProgress] = useState('EN_PROCESO')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const evidence = asEvidence(incident.evidence)

    const followups = useQuery({
        queryKey: ['incident-followups', incident.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('incident_followups').select('id, note, progress, author_name, created_at').eq('incident_id', incident.id).order('created_at')
            if (error) throw error
            return (data ?? []) as Followup[]
        },
    })
    const list = followups.data ?? []
    const last = list[list.length - 1]

    const update = async (patch: Record<string, unknown>, ok: string) => {
        setBusy(true); setMsg(null)
        const { error } = await supabase.from('student_incidents').update(patch).eq('id', incident.id)
        setBusy(false)
        setMsg(error ? { ok: false, text: error.message } : { ok: true, text: ok })
        if (!error) onChanged()
    }
    const addNote = async () => {
        setBusy(true); setMsg(null)
        const { error } = await supabase.from('incident_followups').insert({ tenant_id: tenantId, incident_id: incident.id, note: note.trim(), progress, author_name: myName || null })
        setBusy(false)
        if (error) return setMsg({ ok: false, text: error.message })
        setNote(''); setMsg({ ok: true, text: 'Avance anotado.' })
        qc.invalidateQueries({ queryKey: ['incident-followups', incident.id] })
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="ip-title" onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] flex flex-col">
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-black text-slate-500">{INC(incident.folio)} · {when(incident.occurred_at ?? incident.created_at)}</p>
                        <h2 id="ip-title" className="text-xl font-black text-slate-900 truncate">{studentName(student)} <span className="text-slate-500 font-bold">· {groupName(group)}</span></h2>
                        <p className="text-sm text-slate-600">{incident.catalog_item || incident.title} · {TYPE_LABEL[incident.type]} · {SEVERITY_LABEL[incident.severity]}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <button onClick={() => print(<IncidentSheet school={school} incident={{ ...incident, agreements, action_taken: measures }} student={student} group={group} author={author} followups={list} />)} aria-label="Imprimir hoja" className="p-2 rounded-xl hover:bg-slate-100"><Printer className="w-5 h-5" /></button>
                        <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="p-5 space-y-3 overflow-y-auto">
                    <div className="flex flex-wrap items-center justify-between gap-2 -mt-1">
                        <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">Estado
                            <select value={incident.status} disabled={busy} onChange={e => update({ status: e.target.value }, 'Estado actualizado.')} className={input}>
                                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select></label>
                        <AccordionToggleAll acc={acc} />
                    </div>
                    {msg && <p role={msg.ok ? 'status' : 'alert'} className={`flex items-start gap-2 text-sm font-bold rounded-2xl px-4 py-3 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}{msg.text}</p>}

                    <AccordionSection title="Relato de acontecimientos" {...fold('story')} summary={incident.description ?? 'Sin relato'}>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{incident.description || 'Sin relato.'}</p>
                        <dl className="grid sm:grid-cols-3 gap-2 mt-3 text-sm">
                            <div><dt className="text-xs font-black text-slate-500">Lugar</dt><dd className="font-bold text-slate-800">{incident.place || '—'}</dd></div>
                            <div><dt className="text-xs font-black text-slate-500">Involucrados o testigos</dt><dd className="font-bold text-slate-800">{incident.involved || '—'}</dd></div>
                            <div><dt className="text-xs font-black text-slate-500">Registró</dt><dd className="font-bold text-slate-800">{author || '—'}</dd></div>
                        </dl>
                        <p className="text-xs text-slate-500 mt-2">El relato no se modifica. Si hay algo que aclarar, anótalo en «Control de avances».</p>
                    </AccordionSection>

                    <AccordionSection title="Medidas tomadas" {...fold('measures')} tone={measures.trim() ? 'normal' : 'warn'} summary={measures.trim() || 'Sin medidas registradas'}>
                        <textarea aria-label="Medidas tomadas" rows={4} value={measures} onChange={e => setMeasures(e.target.value)} placeholder="Qué se hizo: diálogo, aviso a la familia, citatorio, canalización…" className={`${input} w-full py-2 resize-y`} />
                        <button onClick={() => update({ action_taken: measures.trim() || null }, 'Medidas guardadas.')} disabled={busy || measures === (incident.action_taken ?? '')} className={`${btn} bg-indigo-600 text-white mt-2`}>Guardar medidas</button>
                    </AccordionSection>

                    <AccordionSection title="Pactos y acuerdos" {...fold('agreements')} summary={agreementSummary(agreements)}>
                        <AgreementsEditor value={agreements} onChange={setAgreements} disabled={busy} responsibleHint="Responsable (alumno, familia, docente…)" />
                        <button onClick={() => { const clean = cleanAgreements(agreements); setAgreements(clean); update({ agreements: clean, has_commitment: clean.length > 0 }, 'Acuerdos guardados.') }} disabled={busy} className={`${btn} bg-indigo-600 text-white mt-3`}>Guardar acuerdos</button>
                    </AccordionSection>

                    <AccordionSection title="Control de avances" {...fold('progress')} summary={last ? `${PROGRESS_LABEL[last.progress]} · ${new Date(last.created_at).toLocaleDateString('es-MX')}` : 'Sin avances anotados'}>
                        {followups.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : list.length === 0 ? <p className="text-sm text-slate-500 mb-3">Aún no hay avances anotados.</p> : (
                            <ol className="space-y-2 mb-3 border-l-2 border-slate-200 pl-4">
                                {list.map(f => (
                                    <li key={f.id}>
                                        <p className="text-xs font-black text-slate-500">{when(f.created_at)} · <span className={f.progress === 'CUMPLIDO' ? 'text-emerald-700' : f.progress === 'SIN_AVANCE' ? 'text-amber-700' : 'text-indigo-700'}>{PROGRESS_LABEL[f.progress]}</span>{f.author_name ? ` · ${f.author_name}` : ''}</p>
                                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{f.note}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                        <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                            <textarea aria-label="Nuevo avance" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Qué se observó desde el último registro" className={`${input} w-full py-2 resize-y`} />
                            <div className="flex flex-wrap gap-2">
                                <select aria-label="Avance" value={progress} onChange={e => setProgress(e.target.value)} className={input}>{Object.entries(PROGRESS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                                <button onClick={addNote} disabled={busy || note.trim().length < 5} className={`${btn} bg-indigo-600 text-white`}><Plus className="w-4 h-4" /> Anotar avance</button>
                            </div>
                            <p className="text-xs text-slate-500">Cada avance queda con fecha y nombre, y no se puede borrar.</p>
                        </div>
                    </AccordionSection>

                    <AccordionSection title="Evidencias" {...fold('evidence')} summary={evidence.length ? `${evidence.length} archivo${evidence.length === 1 ? '' : 's'}` : 'Sin evidencias'}>
                        <EvidenceBox tenantId={tenantId} folder={`incidencias/${incident.id}`} value={evidence} onChange={(v: EvidenceFile[]) => update({ evidence: v }, 'Evidencia guardada.')} />
                    </AccordionSection>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- Catálogo

const CatalogTab = ({ tenantId, catalog, own, canManage, onChanged }: { tenantId: string; catalog: CatalogItem[]; own: (CatalogItem & { id: string; active: boolean })[]; canManage: boolean; onChanged: () => void }) => {
    const [name, setName] = useState('')
    const [type, setType] = useState<IncidentType>('CONDUCTA')
    const [severity, setSeverity] = useState<Severity>('BAJA')
    const [measure, setMeasure] = useState('')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')
    const add = async () => {
        setBusy(true); setErr('')
        const { error } = await supabase.from('incident_catalog').insert({ tenant_id: tenantId, name: name.trim(), type, severity, measure: measure.trim() || null })
        setBusy(false)
        if (error) return setErr(error.code === '23505' ? 'Ya existe una incidencia con ese nombre.' : error.message)
        setName(''); setMeasure(''); onChanged()
    }
    const toggle = async (id: string, active: boolean) => { await supabase.from('incident_catalog').update({ active }).eq('id', id); onChanged() }
    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600">El catálogo unifica cómo se nombra cada incidencia y qué medida corresponde, para que toda la escuela registre igual. Trae una base y la escuela puede agregar las de su reglamento.</p>
            {canManage && (
                <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-2">
                    <h2 className="font-black text-slate-900">Agregar al catálogo</h2>
                    <div className="flex flex-wrap gap-2">
                        <input aria-label="Nombre de la incidencia" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la incidencia" maxLength={120} className={`${input} flex-1 min-w-56`} />
                        <select aria-label="Tipo" value={type} onChange={e => setType(e.target.value as IncidentType)} className={input}>{(Object.keys(TYPE_LABEL) as IncidentType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
                        <select aria-label="Gravedad" value={severity} onChange={e => setSeverity(e.target.value as Severity)} className={input}>{(Object.keys(SEVERITY_LABEL) as Severity[]).map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}</select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input aria-label="Medida que corresponde" value={measure} onChange={e => setMeasure(e.target.value)} placeholder="Medida que corresponde según el reglamento (opcional)" className={`${input} flex-1 min-w-56`} />
                        <button onClick={add} disabled={busy || name.trim().length < 4} className={`${btn} bg-indigo-600 text-white`}><Plus className="w-4 h-4" /> Agregar</button>
                    </div>
                    {err && <p role="alert" className="text-sm font-bold text-rose-700">{err}</p>}
                </div>
            )}
            {(Object.keys(TYPE_LABEL) as IncidentType[]).map(t => {
                const rows = catalog.filter(c => c.type === t)
                if (!rows.length) return null
                return (
                    <section key={t} className="bg-white border border-slate-200 rounded-3xl p-4">
                        <h2 className="font-black text-slate-900 mb-2">{TYPE_LABEL[t]} ({rows.length})</h2>
                        <ul className="divide-y divide-slate-100">
                            {rows.map(c => {
                                const mine = own.find(o => o.name === c.name)
                                return (
                                    <li key={c.name} className={`py-2 flex flex-wrap items-start gap-2 ${mine && !mine.active ? 'opacity-50' : ''}`}>
                                        <span className={`text-xs font-black rounded-lg px-2 py-1 shrink-0 ${sevTone[c.severity]}`}>{SEVERITY_LABEL[c.severity]}</span>
                                        <span className="flex-1 min-w-56"><span className="block text-sm font-black text-slate-900">{c.name}{mine && <span className="ml-2 text-xs font-bold text-indigo-700">de la escuela</span>}</span>
                                            {c.measure && <span className="block text-sm text-slate-600">Medida: {c.measure}</span>}</span>
                                        {mine && canManage && <button onClick={() => toggle(mine.id, !mine.active)} className="text-xs font-black text-indigo-700 underline min-h-9">{mine.active ? 'Dejar de usar' : 'Volver a usar'}</button>}
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                )
            })}
        </div>
    )
}

// ---------------------------------------------------------------- Hojas prefoliadas

const SheetsTab = ({ school, blanks, incidents, onChanged, print }: { school: string; blanks: BlankFolio[]; incidents: Incident[]; onChanged: () => void; print: PrintFn }) => {
    const [count, setCount] = useState(5)
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')
    const pending = blanks.filter(b => !b.incident_id)
    const printBlanks = (folios: number[]) => print(<>{folios.map(f => <IncidentSheet key={f} school={school} incident={{ folio: f }} />)}</>)
    const reserve = async () => {
        setBusy(true); setErr('')
        const { data, error } = await supabase.rpc('reserve_incident_folios', { p_count: count })
        setBusy(false)
        if (error) return setErr(error.message)
        onChanged(); printBlanks((data ?? []) as number[])
    }
    return (
        <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3">
                <h2 className="font-black text-slate-900">Cómo funcionan los folios</h2>
                <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
                    <li>Cada incidencia recibe el siguiente número de la escuela. El folio no se puede cambiar ni repetir, y los registros no se borran: así no faltan hojas en la bitácora.</li>
                    <li>Desde cualquier registro se imprime su hoja con folio para firma del alumno, la familia y quien registra.</li>
                    <li>Si se va a llenar a mano (sin internet, en una salida), imprime hojas en blanco ya foliadas y captúralas después eligiendo su folio.</li>
                </ul>
                <div className="flex flex-wrap items-end gap-2 pt-1">
                    <label className="block"><span className="block text-xs font-black text-slate-600 mb-1">Hojas en blanco a imprimir</span>
                        <input type="number" min={1} max={40} value={count} onChange={e => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className={`${input} w-28`} /></label>
                    <button onClick={reserve} disabled={busy} className={`${btn} bg-indigo-600 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Apartar folios e imprimir</button>
                </div>
                {err && <p role="alert" className="text-sm font-bold text-rose-700">{err}</p>}
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h2 className="font-black text-slate-900">Hojas apartadas ({blanks.length}) · {pending.length} sin capturar</h2>
                    {pending.length > 0 && <button onClick={() => printBlanks(pending.map(b => b.folio).reverse())} className={`${btn} bg-white border border-slate-200 text-slate-700`}><Printer className="w-4 h-4" /> Reimprimir las pendientes</button>}
                </div>
                {blanks.length === 0 ? <p className="text-sm text-slate-500">Aún no se han apartado hojas.</p> : (
                    <ul className="flex flex-wrap gap-2">
                        {blanks.map(b => {
                            const used = incidents.some(i => i.id === b.incident_id)
                            return <li key={b.folio} className={`text-xs font-black rounded-lg px-2 py-1 ${used ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{INC(b.folio)} · {used ? 'capturada' : 'sin capturar'}</li>
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}
