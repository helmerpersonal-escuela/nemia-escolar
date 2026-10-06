import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ChevronRight, ExternalLink, GraduationCap, Loader2, Printer, Search, UserRound } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { niceSubjectCase } from '../../../lib/subjectName'
import { conductByPeriod, matchesName, overallAverage, shortPeriodName, summarizeAttendance, summarizeByPeriod, summarizeSubjects, type AssignmentRow, type GradeRow, type Period } from '../lib/studentReport'

interface StudentRow { id: string; first_name: string; last_name_paternal: string; last_name_maternal: string | null; group_id: string | null; status: string | null }
interface Group { id: string; grade: string; section: string }

const fullName = (s: StudentRow) => [s.last_name_paternal, s.last_name_maternal, s.first_name].filter(Boolean).join(' ')
const day = (iso?: string | null) => iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const input = 'min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:border-indigo-400 outline-none'
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const INCIDENT_TYPE: Record<string, string> = { CONDUCTA: 'Conducta', ACADEMICO: 'Académico', EMOCIONAL: 'Emocional', POSITIVO: 'Reconocimiento', SALUD: 'Salud' }
const SEVERITY: Record<string, string> = { BAJA: 'Leve', MEDIA: 'Media', ALTA: 'Grave' }
const OUTCOME: Record<string, string> = { PROMOVIDO: 'Promovido', REPITE: 'Repite', EGRESADO: 'Egresó', BAJA: 'Baja' }
const SECTIONS = [['grades', 'Calificaciones por materia'], ['attendance', 'Asistencia'], ['conduct', 'Conducta e incidencias'], ['citations', 'Citatorios'], ['family', 'Familia']] as const
type SectionId = typeof SECTIONS[number][0]

/** Consulta de alumnos para dirección: buscar por nombre, grado o grupo y ver la situación del alumno. */
export const StudentLookupPage = () => {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    const [query, setQuery] = useState('')
    const [grade, setGrade] = useState('')
    const [groupId, setGroupId] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const { data, isLoading, error } = useQuery({
        queryKey: ['student-lookup', tenantId],
        enabled: !!tenantId,
        staleTime: 60_000,
        queryFn: async () => {
            const groups = await supabase.from('groups').select('id, grade, section').eq('tenant_id', tenantId!).is('archived_at', null).order('grade').order('section')
            // De mil en mil: una escuela grande pasa del límite de una sola consulta
            const students: StudentRow[] = []
            for (let from = 0; from < 10_000; from += 1000) {
                const { data: page, error: e } = await supabase.from('students').select('id, first_name, last_name_paternal, last_name_maternal, group_id, status')
                    .eq('tenant_id', tenantId!).order('last_name_paternal').order('first_name').range(from, from + 999)
                if (e) throw e
                students.push(...((page ?? []) as StudentRow[]))
                if (!page || page.length < 1000) break
            }
            return { groups: (groups.data ?? []) as Group[], students }
        },
    })

    const groupsById = useMemo(() => new Map((data?.groups ?? []).map(g => [g.id, g])), [data])
    const grades = useMemo(() => [...new Set((data?.groups ?? []).map(g => g.grade))], [data])
    const shown = useMemo(() => (data?.students ?? []).filter(s => {
        const g = s.group_id ? groupsById.get(s.group_id) : undefined
        if (groupId && s.group_id !== groupId) return false
        if (grade && g?.grade !== grade) return false
        return matchesName(fullName(s), query)
    }), [data, groupsById, query, grade, groupId])
    const selected = data?.students.find(s => s.id === selectedId) ?? null
    const filtering = !!(query.trim() || grade || groupId)

    return (
        <div className="space-y-5">
            <header>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Consulta de alumnos</h1>
                <p className="text-slate-600">Busca por nombre, grado o grupo y abre el reporte de situación del alumno.</p>
            </header>

            <div className="grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-5 items-start">
                <section className={`space-y-3 ${selected ? 'hidden lg:block' : ''}`} aria-label="Buscar alumno">
                    <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-2">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="search" aria-label="Nombre del alumno" placeholder="Nombre o apellidos" value={query} onChange={e => setQuery(e.target.value)} className={`${input} w-full pl-10`} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <select aria-label="Grado" value={grade} onChange={e => { setGrade(e.target.value); setGroupId('') }} className={input}>
                                <option value="">Todos los grados</option>
                                {grades.map(g => <option key={g} value={g}>{g}.º grado</option>)}
                            </select>
                            <select aria-label="Grupo" value={groupId} onChange={e => setGroupId(e.target.value)} className={input}>
                                <option value="">Todos los grupos</option>
                                {(data?.groups ?? []).filter(g => !grade || g.grade === grade).map(g => <option key={g.id} value={g.id}>{g.grade}° {g.section}</option>)}
                            </select>
                        </div>
                        <p className="text-xs font-bold text-slate-500" role="status">{isLoading ? 'Cargando…' : `${shown.length} alumno${shown.length === 1 ? '' : 's'}${filtering ? ' con ese filtro' : ''}`}</p>
                    </div>

                    {error && <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudo cargar la lista: {(error as any).message}</p>}
                    {isLoading && <div className="py-10 flex justify-center"><Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /></div>}
                    {!isLoading && !error && shown.length === 0 && <p className="bg-white border border-slate-200 rounded-3xl py-10 text-center text-slate-600 font-bold px-4">{data?.students.length ? 'Ningún alumno coincide.' : 'Todavía no hay alumnos registrados.'}</p>}

                    <ul className="bg-white border border-slate-200 rounded-3xl divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                        {shown.slice(0, 300).map(s => {
                            const g = s.group_id ? groupsById.get(s.group_id) : undefined
                            return (
                                <li key={s.id}>
                                    <button onClick={() => setSelectedId(s.id)} aria-current={selectedId === s.id ? 'true' : undefined}
                                        className={`w-full text-left flex items-center gap-3 px-4 py-3 min-h-14 ${selectedId === s.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                        <span className="text-xs font-black bg-slate-100 text-slate-800 rounded-lg px-2 py-1 shrink-0 w-14 text-center">{g ? `${g.grade}° ${g.section}` : '—'}</span>
                                        <span className="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate">{fullName(s)}</span>
                                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                    {shown.length > 300 && <p className="text-xs text-slate-500 px-2">Se muestran los primeros 300. Escribe un nombre o elige un grupo para acotar.</p>}
                </section>

                <section aria-label="Reporte del alumno" className={selected ? '' : 'hidden lg:block'}>
                    {selected
                        ? <StudentReport key={selected.id} student={selected} group={selected.group_id ? groupsById.get(selected.group_id) : undefined} tenantId={tenantId!} schoolName={(tenant as any)?.name ?? ''} onBack={() => setSelectedId(null)} />
                        : <div className="bg-white border border-dashed border-slate-300 rounded-3xl py-20 text-center text-slate-500"><GraduationCap className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p className="font-bold">Elige un alumno de la lista para ver su reporte.</p></div>}
                </section>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- Reporte

const StudentReport = ({ student, group, tenantId, schoolName, onBack }: { student: StudentRow; group?: Group; tenantId: string; schoolName: string; onBack: () => void }) => {
    const [show, setShow] = useState<Record<SectionId, boolean>>({ grades: true, attendance: true, conduct: true, citations: true, family: true })

    const { data, isLoading, error } = useQuery({
        queryKey: ['student-report', student.id],
        staleTime: 30_000,
        queryFn: async () => {
            const noGroup = '00000000-0000-0000-0000-000000000000'
            const [grades, assignments, subjects, staff, attendance, incidents, citations, guardians, periodRows, history, activeYear] = await Promise.all([
                supabase.from('grades').select('score, is_graded, assignment:assignments(id, title, due_date, subject_id)').eq('student_id', student.id),
                supabase.from('assignments').select('id, title, due_date, subject_id').eq('group_id', student.group_id ?? noGroup),
                supabase.from('group_subjects').select('subject_catalog_id, custom_name, teacher_id, subject_catalog(name)').eq('group_id', student.group_id ?? noGroup),
                supabase.rpc('school_staff'),
                supabase.from('attendance').select('date, status').eq('student_id', student.id).order('date', { ascending: false }).limit(2000),
                supabase.from('student_incidents').select('id, type, severity, title, description, status, created_at').eq('student_id', student.id).order('created_at', { ascending: false }),
                supabase.from('student_citations').select('id, reason, meeting_date, status').eq('student_id', student.id).order('meeting_date', { ascending: false }),
                supabase.from('guardians').select('id, first_name, last_name_paternal, last_name_maternal, relationship, phone, user_id, access_status').eq('student_id', student.id),                supabase.from('evaluation_periods').select('id, name, start_date, end_date').eq('tenant_id', tenantId).order('start_date'),
                supabase.from('student_enrollments').select('id, grade, section, outcome, academic_years(name)').eq('student_id', student.id),
                supabase.from('academic_years').select('start_date, end_date').eq('tenant_id', tenantId).eq('is_active', true).maybeSingle(),
            ])
            const firstError = [grades, assignments, subjects, attendance, incidents].find(r => r.error)?.error
            if (firstError) throw firstError
            const teacher = new Map(((staff.data ?? []) as any[]).map(s => [s.profile_id as string, [s.first_name, s.last_name_paternal].filter(Boolean).join(' ')]))
            const subjectList = ((subjects.data ?? []) as any[]).filter(s => s.subject_catalog_id).map(s => ({
                id: s.subject_catalog_id as string, name: s.custom_name || niceSubjectCase(s.subject_catalog?.name ?? 'Materia'), teacher: s.teacher_id ? teacher.get(s.teacher_id) ?? null : null,
            }))
            const subjectRows = summarizeSubjects(subjectList, (grades.data ?? []) as unknown as GradeRow[], (assignments.data ?? []) as AssignmentRow[])
            // Solo los periodos del ciclo en curso (la escuela puede conservar los de ciclos anteriores)
            const allPeriods = (periodRows.data ?? []) as Period[]
            const y = activeYear.data as { start_date: string; end_date: string } | null
            const inYear = y ? allPeriods.filter(p => p.end_date >= y.start_date && p.start_date <= y.end_date) : []
            const periods = inYear.length ? inYear : allPeriods.slice(-3)
            const byPeriod = summarizeByPeriod(subjectList, (grades.data ?? []) as unknown as GradeRow[], periods)
            return {
                subjectRows, periods, byPeriod,
                average: periods.length ? byPeriod.average : overallAverage(subjectRows),
                conduct: conductByPeriod(periods, (attendance.data ?? []) as any[], (incidents.data ?? []) as any[]),
                history: ((history.data ?? []) as any[]).map(h => ({ id: h.id as string, year: (h.academic_years?.name ?? '') as string, group: `${h.grade ?? ''}° ${h.section ?? ''}`.trim(), outcome: h.outcome as string }))
                    .sort((a, b) => a.year.localeCompare(b.year)),
                attendance: summarizeAttendance((attendance.data ?? []) as any[]),
                incidents: (incidents.data ?? []) as any[],
                citations: (citations.data ?? []) as any[],
                guardians: (guardians.data ?? []) as any[],
            }
        },
    })

    const name = [student.first_name, student.last_name_paternal, student.last_name_maternal].filter(Boolean).join(' ')
    const groupText = group ? `${group.grade}° ${group.section}` : 'Sin grupo'

    /** Abre una hoja limpia con solo las secciones elegidas y lanza la impresión. */
    const print = () => {
        if (!data) return
        const parts: string[] = []
        if (show.grades) {
            const P = data.periods
            const cell = (v: number | null | undefined) => `<td style="text-align:center">${v ?? '—'}</td>`
            parts.push(`<h2>Calificaciones por materia</h2><table><tr><th>Materia</th><th>Docente</th>${P.map((p, i) => `<th>${esc(shortPeriodName(p.name, i))}</th>`).join('')}<th>Promedio</th><th>Sin entregar</th></tr>${data.subjectRows.map(r => {
                const pr = data.byPeriod.rows.find(x => x.subjectId === r.subjectId)
                return `<tr><td>${esc(r.name)}</td><td>${esc(r.teacher ?? '—')}</td>${P.map((_, i) => cell(pr?.byPeriod[i])).join('')}${cell(P.length ? pr?.average : r.average)}<td>${r.missing.length ? esc(r.missing.join('; ')) : '0'}</td></tr>`
            }).join('')}${P.length ? `<tr><th colspan="2">Promedio general</th>${data.byPeriod.general.map(cell).join('')}${cell(data.byPeriod.average)}<td></td></tr>` : ''}</table>${data.history.length ? `<p>Trayectoria: ${data.history.map(h => `${esc(h.year)} · ${esc(h.group)} · ${esc(OUTCOME[h.outcome] ?? h.outcome)}`).join('; ')}</p>` : ''}`)
        }
        if (show.attendance) parts.push(`<h2>Asistencia</h2><p>${data.attendance.total ? `${data.attendance.pct}% de asistencia en ${data.attendance.total} registros: ${data.attendance.present} asistencias, ${data.attendance.late} retardos, ${data.attendance.absent} faltas, ${data.attendance.excused} justificadas.` : 'Sin registros de asistencia.'}${data.attendance.absences.length ? `<br>Faltas: ${data.attendance.absences.slice(0, 30).map(day).join(', ')}` : ''}</p>`)
        if (show.conduct) parts.push(`<h2>Conducta e incidencias (${data.incidents.length})</h2>${data.periods.length ? `<table><tr><th>Por periodo</th>${data.periods.map((p, i) => `<th>${esc(shortPeriodName(p.name, i))}</th>`).join('')}</tr><tr><td>Asistencia</td>${data.conduct.map(c => `<td style="text-align:center">${c.attendancePct != null ? `${c.attendancePct}%` : '—'}</td>`).join('')}</tr><tr><td>Faltas</td>${data.conduct.map(c => `<td style="text-align:center">${c.attendancePct != null ? c.absences : '—'}</td>`).join('')}</tr><tr><td>Incidencias</td>${data.conduct.map(c => `<td style="text-align:center">${c.incidents}</td>`).join('')}</tr><tr><td>Reconocimientos</td>${data.conduct.map(c => `<td style="text-align:center">${c.positives}</td>`).join('')}</tr></table><br>` : ''}${data.incidents.length ? `<table><tr><th>Fecha</th><th>Tipo</th><th>Gravedad</th><th>Descripción</th></tr>${data.incidents.map(i => `<tr><td>${day(i.created_at)}</td><td>${esc(INCIDENT_TYPE[i.type] ?? i.type)}</td><td>${esc(SEVERITY[i.severity] ?? i.severity)}</td><td><b>${esc(i.title)}</b> ${esc(i.description)}</td></tr>`).join('')}</table>` : '<p>Sin incidencias registradas.</p>'}`)
        if (show.citations) parts.push(`<h2>Citatorios (${data.citations.length})</h2>${data.citations.length ? `<ul>${data.citations.map(c => `<li>${day(c.meeting_date)}: ${esc(c.reason)}</li>`).join('')}</ul>` : '<p>Sin citatorios.</p>'}`)
        if (show.family) parts.push(`<h2>Familia</h2>${data.guardians.length ? `<ul>${data.guardians.map(g => `<li>${esc([g.first_name, g.last_name_paternal, g.last_name_maternal].filter(Boolean).join(' '))} (${esc(g.relationship)})${g.phone ? ` · ${esc(g.phone)}` : ''}</li>`).join('')}</ul>` : '<p>Sin tutores registrados.</p>'}`)
        const w = window.open('', '_blank')
        if (!w) return
        w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de ${esc(name)}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:28px;font-size:13px}h1{font-size:20px;margin:0}h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f1f1f1}.sub{color:#555;margin:4px 0 0}</style></head><body><h1>Reporte de situación del alumno</h1><p class="sub">${esc(schoolName)}</p><p class="sub"><b>${esc(name)}</b> · ${esc(groupText)} · Generado el ${day(new Date().toISOString())}</p>${parts.join('')}</body></html>`)
        w.document.close(); w.focus(); w.print()
    }

    return (
        <article className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 space-y-3">
                <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1.5 min-h-11 text-sm font-black text-indigo-700"><ArrowLeft className="w-4 h-4" /> Volver a la lista</button>
                <div className="flex flex-wrap items-start gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><UserRound className="w-6 h-6" /></div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-black text-slate-900">{name}</h2>
                        <p className="text-sm text-slate-600">{groupText}{student.status && student.status !== 'ACTIVE' ? ' · Baja' : ''}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={print} disabled={!data} className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-50"><Printer className="w-4 h-4" /> Imprimir</button>
                        <Link to={`/students/${student.id}`} className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl border border-slate-200 text-sm font-black text-slate-700"><ExternalLink className="w-4 h-4" /> Expediente</Link>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2" aria-label="Qué incluir en el reporte">
                    <span className="text-xs font-bold text-slate-500 self-center">Incluir:</span>
                    {SECTIONS.map(([id, label]) => (
                        <label key={id} className={`inline-flex items-center gap-2 min-h-10 px-3 rounded-xl border text-xs font-black cursor-pointer ${show[id] ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-white border-slate-200 text-slate-500'}`}>
                            <input type="checkbox" className="accent-indigo-600" checked={show[id]} onChange={e => setShow({ ...show, [id]: e.target.checked })} /> {label}
                        </label>
                    ))}
                </div>
            </div>

            {isLoading && <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>}
            {error && <p role="alert" className="m-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudo armar el reporte: {(error as any).message}</p>}

            {data && (
                <div className="p-5 space-y-7">
                    <dl className="grid grid-cols-3 gap-2 text-center">
                        <Kpi label="Promedio general" value={data.average ?? '—'} warn={data.average != null && data.average < 6} />
                        <Kpi label="Asistencia" value={data.attendance.pct != null ? `${data.attendance.pct}%` : '—'} warn={data.attendance.pct != null && data.attendance.pct < 80} />
                        <Kpi label="Incidencias" value={data.incidents.filter(i => i.type !== 'POSITIVO').length} warn={data.incidents.some(i => i.severity === 'ALTA' && i.type !== 'POSITIVO')} />
                    </dl>

                    {show.grades && (
                        <section>
                            <h3 className="font-black text-slate-900 mb-2">Calificaciones por materia</h3>
                            {data.subjectRows.length === 0 ? <p className="text-sm text-slate-500">Su grupo todavía no tiene materias asignadas.</p> : (
                                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
                                    <thead><tr className="text-left text-xs text-slate-500"><th className="py-2">Materia</th><th>Docente</th>
                                        {data.periods.map((p, i) => <th key={p.id} className="text-center" title={p.name}>{shortPeriodName(p.name, i)}</th>)}
                                        <th className="text-center">Promedio</th><th className="text-center">Sin entregar</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.subjectRows.map(r => {
                                            const pr = data.byPeriod.rows.find(x => x.subjectId === r.subjectId)
                                            const avg = data.periods.length ? pr?.average ?? null : r.average
                                            return (
                                                <tr key={r.subjectId}>
                                                    <td className="py-2 font-bold text-slate-800">{r.name}</td>
                                                    <td className="text-slate-600">{r.teacher ?? <span className="text-amber-700">Sin docente</span>}</td>
                                                    {data.periods.map((p, i) => <td key={p.id} className="text-center"><Score value={pr?.byPeriod[i] ?? null} /></td>)}
                                                    <td className="text-center"><Score value={avg} strong /></td>
                                                    <td className="text-center">{r.missing.length ? <span title={r.missing.join('\n')} className="inline-block px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-black">{r.missing.length}</span> : <span className="text-slate-400">0</span>}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    {data.periods.length > 0 && (
                                        <tfoot><tr className="border-t-2 border-slate-200">
                                            <td className="py-2 font-black text-slate-900" colSpan={2}>Promedio general</td>
                                            {data.byPeriod.general.map((v, i) => <td key={i} className="text-center"><Score value={v} strong /></td>)}
                                            <td className="text-center"><Score value={data.byPeriod.average} strong /></td><td />
                                        </tr></tfoot>
                                    )}
                                </table></div>
                            )}
                            {(data.periods.length ? data.byPeriod.rows : data.subjectRows).some(r => r.atRisk) && <p className="mt-2 flex items-start gap-2 text-sm text-rose-800 bg-rose-50 rounded-xl px-3 py-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Promedio menor a 6 en: {(data.periods.length ? data.byPeriod.rows : data.subjectRows).filter(r => r.atRisk).map(r => r.name).join(', ')}.</p>}
                            {data.periods.length > 0 && <p className="text-xs text-slate-500 mt-2">Cada trimestre promedia las actividades calificadas en sus fechas; el promedio es el de los trimestres que ya tienen calificación.</p>}
                        </section>
                    )}

                    {show.attendance && (
                        <section>
                            <h3 className="font-black text-slate-900 mb-2">Asistencia</h3>
                            {data.attendance.total === 0 ? <p className="text-sm text-slate-500">Sin registros de asistencia.</p> : (
                                <>
                                    <dl className="grid grid-cols-4 gap-2 text-center">
                                        <Kpi small label="Asistencias" value={data.attendance.present} /><Kpi small label="Retardos" value={data.attendance.late} />
                                        <Kpi small label="Faltas" value={data.attendance.absent} warn={data.attendance.absent > 0} /><Kpi small label="Justificadas" value={data.attendance.excused} />
                                    </dl>
                                    {data.attendance.absences.length > 0 && <p className="text-sm text-slate-600 mt-2"><b>Faltas:</b> {data.attendance.absences.slice(0, 12).map(day).join(' · ')}{data.attendance.absences.length > 12 ? ` y ${data.attendance.absences.length - 12} más` : ''}</p>}
                                </>
                            )}
                        </section>
                    )}

                    {show.conduct && (
                        <section>
                            <h3 className="font-black text-slate-900 mb-2">Conducta e incidencias ({data.incidents.length})</h3>
                            {data.periods.length > 0 && (
                                <div className="overflow-x-auto mb-3"><table className="w-full text-sm min-w-[420px]">
                                    <thead><tr className="text-left text-xs text-slate-500"><th className="py-2">Comportamiento por periodo</th>{data.periods.map((p, i) => <th key={p.id} className="text-center" title={p.name}>{shortPeriodName(p.name, i)}</th>)}</tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr><td className="py-2 font-bold text-slate-800">Asistencia</td>{data.conduct.map((c, i) => <td key={i} className="text-center">{c.attendancePct != null ? <span className={`font-black ${c.attendancePct < 80 ? 'text-rose-700' : 'text-slate-800'}`}>{c.attendancePct}%</span> : <span className="text-slate-400">—</span>}</td>)}</tr>
                                        <tr><td className="py-2 font-bold text-slate-800">Faltas</td>{data.conduct.map((c, i) => <td key={i} className="text-center text-slate-800">{c.attendancePct != null ? c.absences : <span className="text-slate-400">—</span>}</td>)}</tr>
                                        <tr><td className="py-2 font-bold text-slate-800">Incidencias</td>{data.conduct.map((c, i) => <td key={i} className="text-center"><span className={c.incidents ? 'font-black text-amber-800' : 'text-slate-500'}>{c.incidents}</span></td>)}</tr>
                                        <tr><td className="py-2 font-bold text-slate-800">Reconocimientos</td>{data.conduct.map((c, i) => <td key={i} className="text-center"><span className={c.positives ? 'font-black text-emerald-700' : 'text-slate-500'}>{c.positives}</span></td>)}</tr>
                                    </tbody>
                                </table></div>
                            )}
                            {data.incidents.length === 0 ? <p className="text-sm text-slate-500">Sin incidencias registradas.</p> : (
                                <ul className="space-y-2">
                                    {data.incidents.map(i => (
                                        <li key={i.id} className="border border-slate-200 rounded-2xl p-3">
                                            <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                                                <span className={`px-2 py-0.5 rounded-lg ${i.type === 'POSITIVO' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>{INCIDENT_TYPE[i.type] ?? i.type}</span>
                                                {i.type !== 'POSITIVO' && <span className={`px-2 py-0.5 rounded-lg ${i.severity === 'ALTA' ? 'bg-rose-100 text-rose-800' : i.severity === 'MEDIA' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{SEVERITY[i.severity] ?? i.severity}</span>}
                                                <span className="text-slate-500 font-bold">{day(i.created_at)}</span>
                                                {i.status === 'OPEN' && <span className="text-amber-800">Sin resolver</span>}
                                            </div>
                                            <p className="text-sm font-bold text-slate-900 mt-1">{i.title}</p>
                                            <p className="text-sm text-slate-600">{i.description}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

                    {show.citations && (
                        <section>
                            <h3 className="font-black text-slate-900 mb-2">Citatorios ({data.citations.length})</h3>
                            {data.citations.length === 0 ? <p className="text-sm text-slate-500">Sin citatorios.</p> : (
                                <ul className="space-y-1 text-sm">{data.citations.map(c => <li key={c.id}><b>{day(c.meeting_date)}:</b> {c.reason}</li>)}</ul>
                            )}
                        </section>
                    )}

                    {show.grades && data.history.length > 0 && (
                        <section>
                            <h3 className="font-black text-slate-900 mb-2">Trayectoria en la escuela</h3>
                            <ul className="flex flex-wrap gap-2 text-sm">
                                {data.history.map(h => <li key={h.id} className="border border-slate-200 rounded-xl px-3 py-2"><b>{h.year}</b> · {h.group} · {OUTCOME[h.outcome] ?? h.outcome}</li>)}
                                <li className="border border-indigo-200 bg-indigo-50 rounded-xl px-3 py-2 text-indigo-900"><b>Ciclo actual</b> · {groupText}</li>
                            </ul>
                        </section>
                    )}

                    {show.family && (
                        <section>
                            <h3 className="font-black text-slate-900 mb-2">Familia</h3>
                            {data.guardians.length === 0 ? <p className="text-sm text-slate-500">Sin madre, padre o tutor registrado.</p> : (
                                <ul className="space-y-2">
                                    {data.guardians.map(g => (
                                        <li key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
                                            <span className="font-bold text-slate-800">{[g.first_name, g.last_name_paternal, g.last_name_maternal].filter(Boolean).join(' ')}</span>
                                            <span className="text-slate-500">({g.relationship})</span>
                                            {g.phone && <a href={`tel:${String(g.phone).replace(/[^\d+]/g, '')}`} className="font-bold text-indigo-700 underline">{g.phone}</a>}
                                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${g.user_id && g.access_status !== 'REVOKED' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{g.user_id && g.access_status !== 'REVOKED' ? 'Con cuenta en la app' : 'Sin cuenta'}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}
                </div>
            )}
        </article>
    )
}

const Score = ({ value, strong }: { value: number | null; strong?: boolean }) => (
    <span className={`inline-block min-w-10 px-2 py-0.5 rounded-lg ${strong ? 'font-black' : 'font-bold'} ${value == null ? 'text-slate-400' : value < 6 ? 'bg-rose-100 text-rose-800' : strong ? 'bg-emerald-50 text-emerald-800' : 'text-slate-800'}`}>{value ?? '—'}</span>
)

const Kpi = ({ label, value, warn, small }: { label: string; value: number | string; warn?: boolean; small?: boolean }) => (
    <div className={`rounded-2xl py-3 ${warn ? 'bg-rose-50' : 'bg-slate-50'}`}>
        <dd className={`${small ? 'text-xl' : 'text-2xl'} font-black ${warn ? 'text-rose-700' : 'text-slate-900'}`}>{value}</dd>
        <dt className="text-xs font-bold text-slate-600">{label}</dt>
    </div>
)
