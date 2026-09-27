import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, ArrowRight, BookOpen, CalendarRange, CheckCircle2, ChevronDown, GraduationCap,
    Loader2, Plus, Sparkles, Users, X, ArrowUpRight, Archive, History,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { DateInput, formatDateEs } from '../../../components/ui/DateInput'
import { OfficialCycleNote, type CycleSource } from '../../../components/academic/OfficialCycleNote'
import { fetchOfficialCycle, cycleNameFromDates } from '../../../lib/officialCalendar'

/**
 * Asistente "Nuevo ciclo escolar": cierra el ciclo actual y abre el siguiente.
 *  - Los grupos suben de grado (1° C → 2° C) con sus alumnos, materias y docentes.
 *  - El último grado egresa: la generación queda guardada en el historial.
 *  - Se agregan los grupos de nuevo ingreso (por lo general, primer grado).
 *  - El programa analítico y las planeaciones se copian para seguir mejorándolos.
 * Todo se aplica en una sola operación en el servidor (start_new_school_year).
 */

type Action = 'PROMOTE' | 'GRADUATE' | 'CLOSE'
type Outcome = 'PROMOVIDO' | 'REPITE' | 'EGRESADO' | 'BAJA'

interface StudentRow { id: string; name: string }
interface GroupRow { id: string; grade: number; section: string; shift: string | null; students: StudentRow[] }
interface GroupPlan { action: Action; newGrade: number; newSection: string; outcomes: Record<string, Outcome> }
interface NewGroup { grade: number; section: string }

const STEPS = [
    { title: 'Nuevo ciclo', icon: CalendarRange },
    { title: 'Grupos', icon: Users },
    { title: 'Alumnos', icon: GraduationCap },
    { title: 'Nuevo ingreso', icon: Plus },
    { title: 'Tu trabajo', icon: BookOpen },
    { title: 'Confirmar', icon: CheckCircle2 },
]

const maxGradeFor = (level?: string | null) => (level === 'PRIMARY' ? 6 : 3)

const addYear = (iso?: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-').map(Number)
    return `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const OUTCOME_LABEL: Record<Outcome, string> = { PROMOVIDO: 'Sube', REPITE: 'Repite', EGRESADO: 'Egresa', BAJA: 'Baja' }

export const NewSchoolYearWizard = () => {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const { data: tenant } = useTenant()
    const maxGrade = maxGradeFor(tenant?.educationalLevel)
    const [step, setStep] = useState(0)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<{ groups: number; students: number; graduated: number; lesson_plans: number } | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['new-cycle-source', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const [{ data: year }, { data: groups, error: gErr }] = await Promise.all([
                supabase.from('academic_years').select('id, name, start_date, end_date').eq('tenant_id', tenant!.id).eq('is_active', true).maybeSingle(),
                supabase.from('groups').select('id, grade, section, shift').eq('tenant_id', tenant!.id).is('archived_at', null).order('grade').order('section'),
            ])
            if (gErr) throw gErr
            const ids = (groups ?? []).map(g => g.id)
            const { data: students } = ids.length
                ? await supabase.from('students').select('id, first_name, last_name_paternal, last_name_maternal, group_id, status').in('group_id', ids).order('last_name_paternal')
                : { data: [] as any[] }
            const rows: GroupRow[] = (groups ?? []).map(g => ({
                id: g.id,
                grade: Number(g.grade) || 1,
                section: String(g.section ?? '').toUpperCase(),
                shift: g.shift,
                students: (students ?? [])
                    .filter(s => s.group_id === g.id && !['GRADUATED', 'INACTIVE'].includes(s.status ?? ''))
                    .map(s => ({ id: s.id, name: [s.first_name, s.last_name_paternal, s.last_name_maternal].filter(Boolean).join(' ') })),
            }))
            let official = null
            try { official = await fetchOfficialCycle('BASICA', undefined, year?.end_date ?? undefined) } catch { official = null }
            return { year, groups: rows, official }
        },
    })

    // --- Estado del asistente -------------------------------------------------
    const [cycle, setCycle] = useState({ name: '', start: '', end: '', source: 'estimado' as CycleSource })
    const [plans, setPlans] = useState<Record<string, GroupPlan>>({})
    const [newGroups, setNewGroups] = useState<NewGroup[]>([])
    const [newSection, setNewSection] = useState('')
    const [newGrade, setNewGrade] = useState(1)
    const [copyProgram, setCopyProgram] = useState(true)
    const [copyPlans, setCopyPlans] = useState(true)
    const [openGroup, setOpenGroup] = useState<string | null>(null)

    useEffect(() => {
        if (!data) return
        const { year, groups, official } = data
        if (official) {
            setCycle({ name: official.name, start: official.startDate, end: official.endDate, source: 'oficial' })
        } else {
            const start = addYear(year?.start_date) || ''
            const end = addYear(year?.end_date) || ''
            setCycle({ name: cycleNameFromDates(start, end), start, end, source: 'estimado' })
        }
        const initial: Record<string, GroupPlan> = {}
        groups.forEach(g => {
            const graduates = g.grade >= maxGrade
            initial[g.id] = {
                action: graduates ? 'GRADUATE' : 'PROMOTE',
                newGrade: Math.min(g.grade + 1, maxGrade),
                newSection: g.section,
                outcomes: Object.fromEntries(g.students.map(s => [s.id, graduates ? 'EGRESADO' : 'PROMOVIDO'])) as Record<string, Outcome>,
            }
        })
        setPlans(initial)
        const firstGrade = groups.filter(g => g.grade === 1).map(g => g.section)
        setNewGroups((firstGrade.length ? firstGrade : ['A']).map(section => ({ grade: 1, section })))
    }, [data, maxGrade])

    const groups = data?.groups ?? []

    const setPlan = (id: string, patch: Partial<GroupPlan>) => setPlans(p => ({ ...p, [id]: { ...p[id], ...patch } }))

    const changeAction = (g: GroupRow, action: Action) => {
        const def: Outcome = action === 'PROMOTE' ? 'PROMOVIDO' : action === 'GRADUATE' ? 'EGRESADO' : 'BAJA'
        setPlan(g.id, { action, outcomes: Object.fromEntries(g.students.map(s => [s.id, def])) as Record<string, Outcome> })
    }

    const summary = useMemo(() => {
        let promote = 0, graduate = 0, close = 0
        const count: Record<Outcome, number> = { PROMOVIDO: 0, REPITE: 0, EGRESADO: 0, BAJA: 0 }
        groups.forEach(g => {
            const p = plans[g.id]; if (!p) return
            if (p.action === 'PROMOTE') promote++; else if (p.action === 'GRADUATE') graduate++; else close++
            g.students.forEach(s => { count[p.outcomes[s.id] ?? 'PROMOVIDO']++ })
        })
        return { promote, graduate, close, count }
    }, [groups, plans])

    // Grupos del nuevo ciclo (para detectar duplicados como dos "2° C")
    const resulting = useMemo(() => {
        const list: string[] = []
        groups.forEach(g => { const p = plans[g.id]; if (p?.action === 'PROMOTE') list.push(`${p.newGrade}°${p.newSection.trim().toUpperCase()}`) })
        newGroups.forEach(n => list.push(`${n.grade}°${n.section.trim().toUpperCase()}`))
        return list
    }, [groups, plans, newGroups])
    const duplicates = resulting.filter((k, i) => resulting.indexOf(k) !== i)

    const cycleValid = !!cycle.name.trim() && !!cycle.start && !!cycle.end && cycle.end > cycle.start
    const canNext = step === 0 ? cycleValid : step === 3 ? duplicates.length === 0 : true

    const addNewGroup = () => {
        const section = newSection.trim().toUpperCase()
        if (!section) return
        setNewGroups(prev => [...prev, { grade: newGrade, section }])
        setNewSection('')
    }

    const submit = async () => {
        setSaving(true)
        setError(null)
        try {
            const payload = {
                new_year: { name: cycle.name.trim().toUpperCase(), start_date: cycle.start, end_date: cycle.end },
                groups: groups.map(g => {
                    const p = plans[g.id]
                    return {
                        old_group_id: g.id,
                        action: p.action,
                        new_grade: String(p.newGrade),
                        new_section: p.newSection.trim().toUpperCase() || g.section,
                        students: g.students.map(s => ({ id: s.id, outcome: p.outcomes[s.id] })),
                    }
                }),
                new_groups: newGroups.map(n => ({ grade: String(n.grade), section: n.section.trim().toUpperCase(), shift: groups[0]?.shift ?? 'MORNING' })),
                copy_analytical_program: copyProgram,
                copy_lesson_plans: copyPlans,
            }
            const { data: res, error: rpcError } = await supabase.rpc('start_new_school_year', { p: payload })
            if (rpcError) throw rpcError
            setResult(res as any)
            await qc.invalidateQueries()
        } catch (e: any) {
            setError(e?.message || 'No se pudo iniciar el nuevo ciclo. Intenta de nuevo.')
        } finally {
            setSaving(false)
        }
    }

    // --- Vistas ---------------------------------------------------------------
    if (isLoading || !data) {
        return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    }

    if (result) {
        return (
            <div className="max-w-xl mx-auto py-8 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><CheckCircle2 className="w-10 h-10" /></div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900">¡{cycle.name} listo!</h1>
                    <p className="text-slate-500 mt-2">El ciclo anterior quedó guardado en el historial.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-left">
                    {[
                        ['Grupos del nuevo ciclo', result.groups],
                        ['Alumnos que continúan', result.students],
                        ['Alumnos egresados', result.graduated],
                        ['Planeaciones copiadas', result.lesson_plans],
                    ].map(([l, v]) => (
                        <div key={l as string} className="bg-white rounded-2xl border border-slate-100 p-4">
                            <div className="text-2xl font-black text-slate-900">{v as number}</div>
                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">{l as string}</div>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={() => navigate('/groups')} className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm">Ver mis grupos</button>
                    <button onClick={() => navigate('/analytical-program')} className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-sm">Revisar programa analítico</button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto pb-28 sm:pb-10">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 mb-4"><ArrowLeft className="w-4 h-4" /> Volver</button>
            <div className="mb-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Cierre de ciclo {data.year?.name ? `· ${data.year.name}` : ''}</p>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Iniciar el nuevo ciclo escolar</h1>
            </div>

            {/* Pasos */}
            <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-hide">
                {STEPS.map((s, i) => (
                    <button key={s.title} onClick={() => i < step && setStep(i)} disabled={i > step}
                        className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap ${i === step ? 'bg-indigo-600 text-white' : i < step ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                        <s.icon className="w-4 h-4" /> {i + 1}. {s.title}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 sm:p-8 space-y-6">
                {step === 0 && (
                    <>
                        <Header title="Datos del nuevo ciclo" text="Se toman del calendario escolar oficial de la SEP cuando está disponible. Puedes cambiarlos." />
                        <Field label="Nombre del ciclo">
                            <input value={cycle.name} onChange={e => setCycle(c => ({ ...c, name: e.target.value.toUpperCase(), source: 'manual' }))} className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold" placeholder="CICLO 2026-2027" />
                        </Field>
                        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
                            <Field label="Inicio de clases">
                                <DateInput aria-label="Inicio de clases" value={cycle.start} onChange={e => setCycle(c => ({ ...c, start: e.target.value, source: 'manual' }))} className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold" />
                            </Field>
                            <Field label="Fin de clases">
                                <DateInput aria-label="Fin de clases" value={cycle.end} onChange={e => setCycle(c => ({ ...c, end: e.target.value, source: 'manual' }))} className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold" />
                            </Field>
                        </div>
                        {cycle.start && cycle.end && cycle.end <= cycle.start && <p className="text-sm font-bold text-rose-600">La fecha de fin debe ser posterior al inicio.</p>}
                        <OfficialCycleNote source={cycle.source} official={data.official}
                            onUseOfficial={() => data.official && setCycle({ name: data.official.name, start: data.official.startDate, end: data.official.endDate, source: 'oficial' })} />
                    </>
                )}

                {step === 1 && (
                    <>
                        <Header title="¿Qué pasa con cada grupo?" text={`Los grupos suben de grado con sus alumnos, materias y docentes. El ${maxGrade}° grado egresa y se guarda en el historial.`} />
                        {groups.length === 0 && <p className="text-sm text-slate-500">No tienes grupos en el ciclo actual. Continúa para crear los del nuevo ciclo.</p>}
                        <div className="space-y-3">
                            {groups.map(g => {
                                const p = plans[g.id]; if (!p) return null
                                return (
                                    <div key={g.id} className="rounded-2xl border border-slate-100 p-4 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="font-black text-slate-900">{g.grade}° {g.section} <span className="text-xs font-bold text-slate-400">· {g.students.length} alumnos</span></p>
                                            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-black">
                                                {(['PROMOTE', 'GRADUATE', 'CLOSE'] as Action[]).map(a => (
                                                    <button key={a} onClick={() => changeAction(g, a)} disabled={a === 'PROMOTE' && g.grade >= maxGrade}
                                                        className={`px-3 py-1.5 rounded-lg ${p.action === a ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'} disabled:opacity-30`}>
                                                        {a === 'PROMOTE' ? 'Sube' : a === 'GRADUATE' ? 'Egresa' : 'Cerrar'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {p.action === 'PROMOTE' && (
                                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                                <span className="font-bold text-slate-500">{g.grade}° {g.section}</span>
                                                <ArrowUpRight className="w-4 h-4 text-indigo-500" />
                                                <select aria-label="Nuevo grado" value={p.newGrade} onChange={e => setPlan(g.id, { newGrade: Number(e.target.value) })} className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100 font-bold">
                                                    {Array.from({ length: maxGrade }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}°</option>)}
                                                </select>
                                                <input aria-label="Grupo" value={p.newSection} maxLength={3} onChange={e => setPlan(g.id, { newSection: e.target.value.toUpperCase() })} className="w-16 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100 font-bold text-center" />
                                                <span className="text-xs text-slate-400">en {cycle.name}</span>
                                            </div>
                                        )}
                                        {p.action === 'GRADUATE' && <p className="text-xs font-bold text-emerald-700 flex items-center gap-1"><Archive className="w-3.5 h-3.5" /> La generación egresa y queda en el historial.</p>}
                                        {p.action === 'CLOSE' && <p className="text-xs font-bold text-slate-500">El grupo se cierra; sus alumnos se dan de baja (quedan en el historial).</p>}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <Header title="Revisa a los alumnos" text="Por omisión todos siguen a su nuevo grupo. Marca solo las excepciones: quien repite grado o se da de baja." />
                        <div className="space-y-2">
                            {groups.map(g => {
                                const p = plans[g.id]; if (!p) return null
                                const options: Outcome[] = p.action === 'PROMOTE' ? ['PROMOVIDO', 'REPITE', 'BAJA'] : p.action === 'GRADUATE' ? ['EGRESADO', 'REPITE', 'BAJA'] : ['BAJA', 'REPITE']
                                const exceptions = g.students.filter(s => p.outcomes[s.id] !== options[0]).length
                                return (
                                    <div key={g.id} className="rounded-2xl border border-slate-100 overflow-hidden">
                                        <button onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)} className="w-full flex items-center justify-between gap-2 p-4 text-left">
                                            <span className="font-black text-slate-900">{g.grade}° {g.section}
                                                <span className="ml-2 text-xs font-bold text-slate-400">{g.students.length} alumnos{exceptions ? ` · ${exceptions} excepción(es)` : ''}</span>
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openGroup === g.id ? 'rotate-180' : ''}`} />
                                        </button>
                                        {openGroup === g.id && (
                                            <div className="border-t border-slate-100 divide-y divide-slate-50">
                                                {g.students.length === 0 && <p className="p-4 text-sm text-slate-400">Sin alumnos.</p>}
                                                {g.students.map(s => (
                                                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                                                        <span className="text-sm font-bold text-slate-700 min-w-0">{s.name}</span>
                                                        <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-black">
                                                            {options.map(o => (
                                                                <button key={o} onClick={() => setPlan(g.id, { outcomes: { ...p.outcomes, [s.id]: o } })}
                                                                    className={`px-2.5 py-1 rounded-md ${p.outcomes[s.id] === o ? (o === 'BAJA' ? 'bg-rose-600 text-white' : o === 'REPITE' ? 'bg-amber-500 text-white' : 'bg-white text-indigo-700 shadow-sm') : 'text-slate-500'}`}>
                                                                    {OUTCOME_LABEL[o]}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <Header title="Grupos de nuevo ingreso" text="Por lo general se abren los primeros grados. Después podrás agregar a los alumnos (uno por uno o con la importación masiva)." />
                        <div className="flex flex-wrap gap-2">
                            {newGroups.map((n, i) => (
                                <span key={`${n.grade}${n.section}${i}`} className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-black text-sm">
                                    {n.grade}° {n.section}
                                    <button aria-label={`Quitar ${n.grade}° ${n.section}`} onClick={() => setNewGroups(prev => prev.filter((_, j) => j !== i))} className="p-1 rounded-lg hover:bg-indigo-100"><X className="w-3.5 h-3.5" /></button>
                                </span>
                            ))}
                            {newGroups.length === 0 && <span className="text-sm text-slate-400">Sin grupos nuevos.</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select aria-label="Grado" value={newGrade} onChange={e => setNewGrade(Number(e.target.value))} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 font-bold">
                                {Array.from({ length: maxGrade }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}°</option>)}
                            </select>
                            <input aria-label="Letra del grupo" value={newSection} maxLength={3} onChange={e => setNewSection(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && addNewGroup()} placeholder="Letra (A, B, C…)" className="w-36 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 font-bold" />
                            <button onClick={addNewGroup} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm"><Plus className="w-4 h-4" /> Agregar</button>
                        </div>
                        <div className="text-xs text-slate-500">
                            <p className="font-black uppercase tracking-wider mb-1">Grupos del nuevo ciclo</p>
                            <p>{[...resulting].sort().join(' · ') || '—'}</p>
                        </div>
                        {duplicates.length > 0 && <p className="text-sm font-bold text-rose-600">Hay grupos repetidos: {[...new Set(duplicates)].join(', ')}. Cambia la letra de alguno.</p>}
                    </>
                )}

                {step === 4 && (
                    <>
                        <Header title="Tu trabajo continúa" text="Lo que construiste este ciclo se conserva para seguir perfeccionándolo con el nuevo contexto de tus grupos." />
                        <Toggle checked={copyProgram} onChange={setCopyProgram} title="Copiar el programa analítico al nuevo ciclo"
                            text="Conservas diagnóstico, problemáticas, contenidos, PDAs y codiseño. Podrás actualizarlo durante el ciclo y en cada sesión de CTE. El original queda en el historial." />
                        <Toggle checked={copyPlans} onChange={setCopyPlans} title="Copiar planeaciones a los grupos del mismo grado"
                            text="Ejemplo: tus planeaciones de 1° C se copian como borrador al 1° C del nuevo ciclo, listas para ajustarlas." />
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-1">
                            <p className="font-black text-slate-800 flex items-center gap-2"><History className="w-4 h-4" /> Se conserva siempre</p>
                            <p>Rúbricas e instrumentos, tus PDAs propios, el historial de calificaciones y asistencia, y los expedientes de los alumnos.</p>
                        </div>
                    </>
                )}

                {step === 5 && (
                    <>
                        <Header title="Confirma el inicio del ciclo" text="Revisa el resumen. El ciclo actual se cerrará y quedará disponible en el historial." />
                        <ul className="text-sm text-slate-700 space-y-2">
                            <li><b>{cycle.name}</b>: del {formatDateEs(cycle.start)} al {formatDateEs(cycle.end)}</li>
                            <li>{summary.promote} grupo(s) suben de grado · {summary.graduate} egresan · {summary.close} se cierran · {newGroups.length} nuevo(s)</li>
                            <li>Alumnos: {summary.count.PROMOVIDO} suben · {summary.count.EGRESADO} egresan · {summary.count.REPITE} repiten · {summary.count.BAJA} baja</li>
                            <li>Programa analítico: {copyProgram ? 'se copia al nuevo ciclo' : 'no se copia'} · Planeaciones: {copyPlans ? 'se copian como borrador' : 'no se copian'}</li>
                        </ul>
                        {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 rounded-xl p-3">{error}</p>}
                    </>
                )}
            </div>

            {/* Navegación */}
            <div className="fixed sm:static bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 bg-white/95 sm:bg-transparent border-t sm:border-0 border-slate-100 px-4 py-3 sm:px-0 sm:mt-6 flex items-center justify-between gap-3">
                <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || saving} className="px-4 py-3 rounded-2xl text-sm font-black text-slate-500 disabled:opacity-30">Anterior</button>
                {step < STEPS.length - 1 ? (
                    <button onClick={() => setStep(s => s + 1)} disabled={!canNext} className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40">
                        Siguiente <ArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm disabled:opacity-60">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Iniciar {cycle.name || 'ciclo'}
                    </button>
                )}
            </div>
        </div>
    )
}

const Header = ({ title, text }: { title: string; text: string }) => (
    <div>
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{text}</p>
    </div>
)

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">{label}</span>
        {children}
    </label>
)

const Toggle = ({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) => (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-100 p-4 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 w-5 h-5 accent-indigo-600" />
        <span>
            <span className="block font-black text-slate-900 text-sm">{title}</span>
            <span className="block text-sm text-slate-500 mt-0.5">{text}</span>
        </span>
    </label>
)
