import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, FileUp, Info, Loader2, ShieldCheck, Upload, X,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { extractFiles } from '../lib/extract'
import { consolidate, phoneText, type Plan, type PlanStaff } from '../lib/consolidate'
import { applyPlan, SECTION_LABEL, type ApplyOptions, type SectionId, type SectionResult } from '../lib/apply'
import { downloadReport } from '../lib/report'
import { normName } from '../lib/names'
import type { FileSummary, Issue } from '../lib/types'

const ROLE_LABEL: Record<string, string> = {
    DIRECTOR: 'Directivo', ADMIN: 'Administración', ACADEMIC_COORD: 'Coordinación académica', TECH_COORD: 'Coordinación de tecnologías',
    SCHOOL_CONTROL: 'Control escolar', TEACHER: 'Docente', PREFECT: 'Prefectura', SUPPORT: 'Apoyo',
}
const SEV_STYLE: Record<Issue['severity'], string> = {
    error: 'bg-rose-50 border-rose-200 text-rose-900', warning: 'bg-amber-50 border-amber-200 text-amber-900', info: 'bg-slate-50 border-slate-200 text-slate-700',
}
const SEV_LABEL: Record<Issue['severity'], string> = { error: 'Importante', warning: 'Revisar', info: 'Aviso' }
const CTE_ROLES = ['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD']

function previousCycle(cycle?: string) {
    const y = Number(cycle?.slice(0, 4)) || new Date().getFullYear()
    return `${y - 1}-${y}`
}

export const SchoolImportPage = () => {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    const role = String((tenant as any)?.role ?? '').toUpperCase()
    const [files, setFiles] = useState<{ name: string; data: ArrayBuffer }[]>([])
    const [summaries, setSummaries] = useState<FileSummary[]>([])
    const [plan, setPlan] = useState<Plan | null>(null)
    const [busy, setBusy] = useState(false)
    const [schoolCct, setSchoolCct] = useState<string | null>(null)
    const [cctOk, setCctOk] = useState(false)
    const [sections, setSections] = useState<Record<SectionId, boolean>>({
        jornada: true, grupos: true, alumnos: true, tutores: true, personal: true, materias: true, horario: true,
        comisiones: true, cte: true, pemc: true, antecedentes: true,
    })
    const [excluded, setExcluded] = useState<Set<string>>(new Set())
    const [replaceSchedule, setReplaceSchedule] = useState(false)
    const [overwriteJornada, setOverwriteJornada] = useState(false)
    const [historyYear, setHistoryYear] = useState('')
    const [tab, setTab] = useState<'avisos' | 'grupos' | 'personal' | 'materias'>('avisos')
    const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null)
    const [results, setResults] = useState<SectionResult[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!tenantId) return
        supabase.from('school_details').select('cct').eq('tenant_id', tenantId).maybeSingle().then(({ data }) => setSchoolCct(data?.cct ?? null))
    }, [tenantId])

    useEffect(() => {
        if (!CTE_ROLES.includes(role) && role) setSections(s => ({ ...s, cte: false, pemc: false }))
    }, [role])

    const addFiles = async (list: FileList | null) => {
        if (!list?.length) return
        const read = await Promise.all(Array.from(list).map(async f => ({ name: f.name, data: await f.arrayBuffer() })))
        const merged = [...files.filter(f => !read.some(r => r.name === f.name)), ...read]
        setFiles(merged)
        await analyze(merged)
    }

    const analyze = async (list = files) => {
        setBusy(true); setError(null); setResults(null)
        try {
            const ex = await extractFiles(list)
            const p = consolidate(ex)
            setSummaries(ex.files)
            setPlan(p)
            setExcluded(new Set(p.staff.filter(s => s.doubt).map(s => s.key)))
            setHistoryYear(previousCycle(p.meta.cycle))
            setCctOk(false)
        } catch (e) {
            setError((e as Error).message)
        } finally { setBusy(false) }
    }

    const removeFile = async (name: string) => {
        const rest = files.filter(f => f.name !== name)
        setFiles(rest)
        if (rest.length) await analyze(rest); else { setPlan(null); setSummaries([]) }
    }

    const cctMismatch = !!(plan?.meta.cct && schoolCct && normName(plan.meta.cct) !== normName(schoolCct))
    const schoolYear = plan?.meta.cycle ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

    const counts = useMemo(() => {
        if (!plan) return null
        const h = plan.groups.reduce((n, g) => n + g.students.filter(s => s.gender === 'HOMBRE').length, 0)
        const m = plan.groups.reduce((n, g) => n + g.students.filter(s => s.gender === 'MUJER').length, 0)
        return {
            h, m,
            staffOn: plan.staff.filter(s => !excluded.has(s.key)).length,
            withTeacher: plan.subjects.filter(s => s.teacherKey && !excluded.has(s.teacherKey)).length,
            actions: plan.pemc.objectives.reduce((n, o) => n + o.actions.length, 0),
        }
    }, [plan, excluded])

    const runImport = async () => {
        if (!plan || !tenantId) return
        setBusy(true); setError(null); setProgress({ label: 'Preparando…', pct: 0 })
        try {
            const opts: ApplyOptions = { sections, excludedStaff: excluded, replaceSchedule, overwriteJornada, historyYear, schoolYear }
            const r = await applyPlan(plan, opts, tenantId, (label, pct) => setProgress({ label, pct }))
            setResults(r)
        } catch (e) {
            setError((e as Error).message)
        } finally { setBusy(false); setProgress(null) }
    }

    const sectionRows: { id: SectionId; detail: string; extra?: React.ReactNode; disabled?: string }[] = plan ? [
        { id: 'jornada', detail: plan.jornada ? `${plan.jornada.start} a ${plan.jornada.end} · clases de ${plan.jornada.moduleMinutes} min · ${plan.jornada.breaks.map(b => `receso ${b.start_time}–${b.end_time}`).join(', ')}` : 'No viene en los archivos',
          extra: plan.jornada && <Check label="Reemplazar la jornada si ya está capturada" checked={overwriteJornada} onChange={setOverwriteJornada} /> },
        { id: 'grupos', detail: `${plan.groups.length} grupos: ${plan.groups.map(g => g.key).join(', ')}` },
        { id: 'alumnos', detail: `${plan.stats.students} alumnos (${counts?.h} hombres, ${counts?.m} mujeres) · ${plan.stats.curp} con CURP` },
        { id: 'tutores', detail: `${plan.stats.withGuardian} tutores · ${plan.stats.phone1} con teléfono principal · ${plan.stats.phone2} con 1 respaldo · ${plan.stats.phone3} con 2 respaldos` },
        { id: 'personal', detail: `${counts?.staffOn} de ${plan.staff.length} personas marcadas. Quedan listas para invitarlas cuando den su correo.` },
        { id: 'materias', detail: `${plan.subjects.length} materias en los grupos · ${counts?.withTeacher} con su docente previsto` },
        { id: 'horario', detail: `${plan.classes.length} clases a la semana`, extra: <Check label="Reemplazar el horario de los grupos que ya tengan uno" checked={replaceSchedule} onChange={setReplaceSchedule} /> },
        { id: 'comisiones', detail: `${plan.commissions.length} comisiones del ciclo ${schoolYear}` },
        { id: 'cte', detail: `${plan.cte.length} sesiones ordinarias`, disabled: CTE_ROLES.includes(role) ? undefined : 'Solo dirección o coordinación' },
        { id: 'pemc', detail: `${plan.pemc.objectives.length} objetivos · ${counts?.actions} acciones · diagnóstico de ${plan.pemc.diagnosis.length} ámbitos`, disabled: CTE_ROLES.includes(role) ? undefined : 'Solo dirección o coordinación' },
        { id: 'antecedentes', detail: `${plan.history.length} registros (promedios, adeudos, bajas y altas, anotaciones)`,
          extra: <label className="flex items-center gap-2 text-xs text-slate-600">Ciclo de los promedios y adeudos:
              <input value={historyYear} onChange={e => setHistoryYear(e.target.value)} className="w-28 border-2 border-slate-200 rounded-lg px-2 py-1 font-bold" /></label> },
    ] : []

    const available = (id: SectionId) => {
        if (!plan) return false
        const map: Record<SectionId, number> = {
            jornada: plan.jornada ? 1 : 0, grupos: plan.groups.length, alumnos: plan.stats.students, tutores: plan.guardians.length, personal: plan.staff.length,
            materias: plan.subjects.length, horario: plan.classes.length, comisiones: plan.commissions.length, cte: plan.cte.length,
            pemc: plan.pemc.objectives.length + plan.pemc.diagnosis.length, antecedentes: plan.history.length,
        }
        return map[id] > 0
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
            <header>
                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5"><FileUp className="w-4 h-4" /> Arranque de la escuela</p>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Importar la información que ya tiene la escuela</h1>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                    Sube los archivos que la escuela ya usa: listas de asistencia, directorios de padres, horarios, lista de personal,
                    comisiones y PEMC. VUNLEK los lee, te muestra lo que encontró y lo que conviene revisar, y solo guarda lo que confirmes.
                </p>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Los archivos se leen en esta computadora; no se suben ni se guardan tal cual.</p>
            </header>

            {/* 1. Archivos */}
            <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                <h2 className="text-lg font-black text-slate-900">1. Sube los archivos</h2>
                <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
                    className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50"
                >
                    <Upload className="w-8 h-8 mx-auto text-slate-400" />
                    <p className="text-sm text-slate-700 mt-2 font-bold">Arrastra aquí los archivos de Excel (.xlsx) y Word (.docx)</p>
                    <p className="text-xs text-slate-500">Puedes subir varios a la vez, en cualquier orden.</p>
                    <button type="button" onClick={() => inputRef.current?.click()} className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700">
                        <FileUp className="w-4 h-4" /> Elegir archivos
                    </button>
                    <input ref={inputRef} type="file" multiple accept=".xlsx,.xlsm,.docx" className="hidden" aria-label="Elegir archivos de la escuela"
                        onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
                </div>
                {busy && !progress && <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Leyendo archivos…</p>}
                {summaries.length > 0 && (
                    <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                        {summaries.map(f => (
                            <li key={f.name} className="p-3 flex items-start gap-3">
                                {f.kind === 'docx' ? <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" /> : <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-900 break-words">{f.name}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {f.found.map(x => <span key={x} className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">{x}</span>)}
                                        {f.ignored.map(x => <span key={x} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{x.length > 40 ? x : `Sin usar: ${x}`}</span>)}
                                    </div>
                                </div>
                                <button type="button" onClick={() => removeFile(f.name)} aria-label={`Quitar ${f.name}`} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><X className="w-4 h-4" /></button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {plan && (
                <>
                    {/* 2. Revisión */}
                    <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h2 className="text-lg font-black text-slate-900">2. Revisa lo que se va a guardar</h2>
                            <button type="button" onClick={() => downloadReport(plan, results ?? undefined)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700 hover:border-indigo-300">
                                <Download className="w-4 h-4" /> Descargar reporte (Excel)
                            </button>
                        </div>

                        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-sm text-slate-700 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                            <p><b>Escuela:</b> {plan.meta.schoolName ?? '—'}</p>
                            <p><b>CCT:</b> {plan.meta.cct ?? '—'} {schoolCct && <span className="text-slate-500">(en VUNLEK: {schoolCct})</span>}</p>
                            <p><b>Ciclo:</b> {plan.meta.cycle ?? '—'}</p>
                            <p><b>Zona / turno:</b> {plan.meta.zone ?? '—'} · {plan.meta.shift ?? '—'}</p>
                            {plan.meta.location && <p className="sm:col-span-2"><b>Ubicación:</b> {plan.meta.location}</p>}
                        </div>
                        {cctMismatch && (
                            <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
                                <p className="font-black flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Los archivos son de la CCT {plan.meta.cct}, pero tu escuela en VUNLEK es {schoolCct}.</p>
                                <p className="mt-1">Revisa que sean los archivos de esta escuela antes de importar.</p>
                                <Check label="Sí, son de esta escuela" checked={cctOk} onChange={setCctOk} />
                            </div>
                        )}

                        <ul className="grid md:grid-cols-2 gap-3">
                            {sectionRows.map(s => {
                                const can = available(s.id) && !s.disabled
                                return (
                                    <li key={s.id} className={`rounded-2xl border-2 p-4 ${sections[s.id] && can ? 'border-indigo-200 bg-white' : 'border-slate-100 bg-slate-50'}`}>
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input type="checkbox" className="mt-1 w-5 h-5 accent-indigo-600" disabled={!can}
                                                checked={sections[s.id] && can} onChange={e => setSections(x => ({ ...x, [s.id]: e.target.checked }))} />
                                            <span>
                                                <span className="block font-black text-slate-900">{SECTION_LABEL[s.id]}</span>
                                                <span className="block text-sm text-slate-600">{s.disabled ?? s.detail}</span>
                                            </span>
                                        </label>
                                        {s.extra && sections[s.id] && can && <div className="mt-2 pl-8">{s.extra}</div>}
                                    </li>
                                )
                            })}
                        </ul>

                        <div role="tablist" className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
                            {([['avisos', `Avisos (${plan.issues.length})`], ['grupos', 'Grupos y teléfonos'], ['personal', `Personal (${plan.staff.length})`], ['materias', 'Materias por grupo']] as const).map(([id, label]) => (
                                <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
                                    className={`px-3 py-2 rounded-xl text-sm font-bold ${tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
                            ))}
                        </div>

                        {tab === 'avisos' && <IssueList issues={plan.issues} />}
                        {tab === 'grupos' && <GroupsTable plan={plan} />}
                        {tab === 'personal' && <StaffTable staff={plan.staff} excluded={excluded} onToggle={k => setExcluded(x => { const n = new Set(x); n.has(k) ? n.delete(k) : n.add(k); return n })} />}
                        {tab === 'materias' && <SubjectsTable plan={plan} />}
                    </section>

                    {/* 3. Importar */}
                    <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
                        <h2 className="text-lg font-black text-slate-900">3. Importar</h2>
                        <p className="text-sm text-slate-600">Se guarda en orden: jornada, grupos, alumnos, tutores, personal, materias, horario, comisiones, CTE, PEMC y antecedentes. Si lo corres otra vez, no se duplica lo que ya existe.</p>
                        {error && <p className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
                        {progress && (
                            <div aria-live="polite">
                                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Guardando: {progress.label}</p>
                                <div className="h-3 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress.pct}%` }} /></div>
                            </div>
                        )}
                        {!results && (
                            <button type="button" disabled={busy || (cctMismatch && !cctOk) || !Object.values(sections).some(Boolean)} onClick={runImport}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 disabled:opacity-50">
                                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Importar a VUNLEK
                            </button>
                        )}
                        {results && <ResultsTable results={results} onReport={() => downloadReport(plan, results)} />}
                    </section>
                </>
            )}
        </div>
    )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 mt-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
        </label>
    )
}

function IssueList({ issues }: { issues: Issue[] }) {
    const [all, setAll] = useState(false)
    const order = { error: 0, warning: 1, info: 2 }
    const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity])
    const shown = all ? sorted : sorted.slice(0, 25)
    if (!issues.length) return <p className="text-sm text-emerald-700 font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Sin avisos.</p>
    return (
        <div className="space-y-2">
            {shown.map((i, n) => (
                <div key={n} className={`rounded-xl border p-3 text-sm ${SEV_STYLE[i.severity]}`}>
                    <span className="font-black mr-2">{SEV_LABEL[i.severity]} · {i.area}</span>{i.message}
                    {i.source && <span className="block text-xs opacity-70 mt-0.5">{i.source}</span>}
                </div>
            ))}
            {sorted.length > 25 && <button type="button" onClick={() => setAll(!all)} className="text-sm font-bold text-indigo-700 underline">{all ? 'Ver menos' : `Ver los ${sorted.length} avisos`}</button>}
        </div>
    )
}

function GroupsTable({ plan }: { plan: Plan }) {
    const byStudent = new Map(plan.guardians.map(g => [`${g.groupKey}|${g.studentKey}`, g]))
    const [open, setOpen] = useState<string | null>(null)
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 uppercase"><th className="p-2">Grupo</th><th className="p-2">Alumnos</th><th className="p-2">Con tutor</th><th className="p-2">Tel. principal</th><th className="p-2">3 teléfonos</th><th className="p-2"></th></tr></thead>
                <tbody>
                    {plan.groups.map(g => {
                        const gs = g.students.map(s => byStudent.get(`${g.key}|${normName(s.full)}`))
                        return (
                            <Fragment key={g.key}>
                                <tr className="border-t border-slate-100">
                                    <td className="p-2 font-black">{g.grade}° {g.section}</td>
                                    <td className="p-2">{g.students.length}</td>
                                    <td className="p-2">{gs.filter(Boolean).length}</td>
                                    <td className="p-2">{gs.filter(x => x?.phone).length}</td>
                                    <td className="p-2">{gs.filter(x => x?.alt2).length}</td>
                                    <td className="p-2"><button type="button" className="text-indigo-700 font-bold underline text-xs" onClick={() => setOpen(open === g.key ? null : g.key)}>{open === g.key ? 'Ocultar' : 'Ver alumnos'}</button></td>
                                </tr>
                                {open === g.key && (
                                    <tr><td colSpan={6} className="p-2 bg-slate-50">
                                        <ul className="grid sm:grid-cols-2 gap-1 text-xs">
                                            {g.students.map((s, i) => (
                                                <li key={s.full} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                                                    <span><b>{s.full}</b> {s.gender === 'MUJER' ? '· M' : s.gender === 'HOMBRE' ? '· H' : ''}</span>
                                                    <span className={gs[i]?.phone ? 'text-slate-600' : 'text-amber-700 font-bold'}>{gs[i] ? phoneText(gs[i]!.phone) : 'Sin tutor'}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </td></tr>
                                )}
                            </Fragment>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function StaffTable({ staff, excluded, onToggle }: { staff: PlanStaff[]; excluded: Set<string>; onToggle: (k: string) => void }) {
    return (
        <div className="overflow-x-auto">
            <p className="text-xs text-slate-500 mb-2">Desmarca a quien ya no trabaja en la escuela. Nadie recibe acceso todavía: después, en Configuración → Personal, escribes su correo y le envías la invitación.</p>
            <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 uppercase"><th className="p-2"></th><th className="p-2">Nombre</th><th className="p-2">Puesto</th><th className="p-2">Materias y grupos</th><th className="p-2">Encargos</th></tr></thead>
                <tbody>
                    {staff.map(s => (
                        <tr key={s.key} className={`border-t border-slate-100 align-top ${excluded.has(s.key) ? 'opacity-50' : ''}`}>
                            <td className="p-2"><input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={!excluded.has(s.key)} onChange={() => onToggle(s.key)} aria-label={`Importar a ${s.full}`} /></td>
                            <td className="p-2 font-bold text-slate-900">{s.full}{s.doubt && <span className="block text-xs font-normal text-amber-700">{s.doubt}</span>}</td>
                            <td className="p-2 text-slate-700">{s.jobTitle ?? ROLE_LABEL[s.roleHint]}</td>
                            <td className="p-2 text-slate-600">{s.subjects.join(', ')}{s.groups.length > 0 && <span className="block text-xs">{s.groups.join(', ')}</span>}</td>
                            <td className="p-2 text-xs text-slate-600">{s.duties.join('; ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function SubjectsTable({ plan }: { plan: Plan }) {
    const staffName = new Map(plan.staff.map(s => [s.key, s.full]))
    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plan.groups.map(g => (
                <div key={g.key} className="rounded-2xl border border-slate-200 p-3">
                    <p className="font-black text-slate-900 mb-1">{g.grade}° {g.section}</p>
                    <ul className="text-xs space-y-0.5">
                        {plan.subjects.filter(s => s.groupKey === g.key).map(s => (
                            <li key={s.key} className="flex justify-between gap-2"><span className="font-bold">{s.customName ?? s.catalogName}</span><span className="text-slate-500 text-right">{s.teacherKey ? staffName.get(s.teacherKey) : 'Sin docente'}</span></li>
                        ))}
                        {!plan.subjects.some(s => s.groupKey === g.key) && <li className="text-slate-500">Sin horario</li>}
                    </ul>
                </div>
            ))}
        </div>
    )
}

function ResultsTable({ results, onReport }: { results: SectionResult[]; onReport: () => void }) {
    const failed = results.some(r => r.errors.length)
    return (
        <div className="space-y-3">
            <p className={`text-sm font-black flex items-center gap-2 ${failed ? 'text-amber-800' : 'text-emerald-700'}`}>
                {failed ? <Info className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {failed ? 'Importación terminada con algunos errores.' : 'Importación terminada.'}
            </p>
            <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 uppercase"><th className="p-2">Sección</th><th className="p-2">Nuevos</th><th className="p-2">Actualizados</th><th className="p-2">Sin cambio</th></tr></thead>
                <tbody>
                    {results.map(r => (
                        <tr key={r.id} className="border-t border-slate-100 align-top">
                            <td className="p-2 font-bold">{SECTION_LABEL[r.id]}{r.errors.map((e, i) => <span key={i} className="block text-xs font-normal text-rose-700">{e}</span>)}</td>
                            <td className="p-2">{r.created}</td><td className="p-2">{r.updated}</td><td className="p-2">{r.skipped}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onReport} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold"><Download className="w-4 h-4" /> Reporte (Excel)</button>
                <Link to="/groups" className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">Ver grupos</Link>
                <Link to="/settings?tab=personal" className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-sm font-bold">Invitar al personal</Link>
                <Link to="/familias/codigos" className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-sm font-bold">Códigos para familias</Link>
            </div>
        </div>
    )
}
