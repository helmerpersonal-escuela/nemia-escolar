import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardList, GraduationCap, Loader2, Plus, Search, Trash2, Users, UsersRound, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { roleLabel } from '../../../lib/roleLabels'
import { useTenant } from '../../../hooks/useTenant'
import { niceSubjectCase } from '../../../lib/subjectName'
import { AccordionSection, AccordionToggleAll, useAccordion } from '../../../components/ui/Accordion'
import { askConfirm } from '../../../components/ui/ConfirmDialog'
import {
    CARGOS, SUGGESTED_COMMISSIONS, commissionsOf, removeMember, sortMembers, takenUniqueCargo, upsertMember,
    type Commission,
} from '../lib/commissions'
import { WEEK, hhmm, nowAndNext, slotsOfTeacher, type Slot } from '../lib/teacherSchedule'

interface Person { id: string; name: string; roles: string[]; jobTitle: string | null; teaches: boolean }
interface GroupSubject { id: string; group_id: string; subject_catalog_id: string | null; custom_name: string | null; teacher_id: string | null; groups: { grade: string; section: string } | null; subject_catalog: { name: string } | null }
interface Group { id: string; grade: string; section: string }

const TEACHING = ['TEACHER', 'INDEPENDENT_TEACHER']
const groupLabel = (g?: { grade: string; section: string } | null) => g ? `${g.grade}° ${g.section}` : 'Sin grupo'
const subjectLabel = (gs: GroupSubject) => gs.custom_name || niceSubjectCase(gs.subject_catalog?.name ?? 'Materia')
const input = 'min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:border-indigo-400 outline-none'
const btn = 'inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-black disabled:opacity-50'

const KEY = 'staff-control-v3'

/** La hora actual, renovada cada medio minuto, para saber con qué grupo está cada docente. */
function useNow() {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t) }, [])
    return now
}

function useStaffData() {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    return useQuery({
        queryKey: [KEY, tenantId],
        enabled: !!tenantId,
        queryFn: async () => {
            const [staff, gs, groups, profs, year, plans, subjects, sched] = await Promise.all([
                supabase.rpc('school_staff'),
                supabase.from('group_subjects').select('id, group_id, subject_catalog_id, custom_name, teacher_id, groups(grade, section), subject_catalog(name)').eq('tenant_id', tenantId!),
                supabase.from('groups').select('id, grade, section').eq('tenant_id', tenantId!).is('archived_at', null).order('grade').order('section'),
                supabase.from('profiles').select('id, advisory_group_id').eq('tenant_id', tenantId!),
                supabase.from('academic_years').select('id, name').eq('tenant_id', tenantId!).eq('is_active', true).maybeSingle(),
                supabase.from('lesson_plans').select('id, group_id, subject_id, status').eq('tenant_id', tenantId!),
                supabase.from('subject_catalog').select('id, name, educational_level').order('name'),
                supabase.from('schedules').select('id, group_id, subject_id, custom_subject, day_of_week, start_time, end_time').eq('tenant_id', tenantId!),
            ])
            if (staff.error) throw staff.error
            const schoolYear = year.data?.name ?? String(new Date().getFullYear())
            const comm = await supabase.from('school_commissions').select('id, name, school_year, members').eq('tenant_id', tenantId!).eq('school_year', schoolYear).order('name')

            // Una persona puede tener varios puestos: se muestra una sola vez con todos
            const byId = new Map<string, Person>()
            for (const s of (staff.data ?? []) as any[]) {
                const name = [s.first_name, s.last_name_paternal, s.last_name_maternal].filter(Boolean).join(' ') || s.email || 'Sin nombre'
                const p: Person = byId.get(s.profile_id) ?? { id: s.profile_id, name, roles: [], jobTitle: s.job_title ?? null, teaches: false }
                if (!p.roles.includes(s.role)) p.roles.push(s.role)
                byId.set(s.profile_id, p)
            }
            const groupSubjects = (gs.data ?? []) as unknown as GroupSubject[]
            for (const p of byId.values()) p.teaches = p.roles.some(r => TEACHING.includes(r)) || groupSubjects.some(g => g.teacher_id === p.id)

            // Catálogo de materias sin repetidos (hay registros en mayúsculas y minúsculas)
            const seen = new Set<string>()
            const catalog = ((subjects.data ?? []) as any[]).filter(s => {
                const k = String(s.name).toLowerCase()
                if (seen.has(k)) return false
                seen.add(k); return true
            }).map(s => ({ id: s.id as string, name: niceSubjectCase(s.name) }))

            return {
                tenantId: tenantId!, schoolYear,
                people: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
                groupSubjects,
                groups: (groups.data ?? []) as Group[],
                // Objeto simple (no Map): lo consultado se guarda en el dispositivo y un Map no sobrevive a eso
                advisory: Object.fromEntries(((profs.data ?? []) as any[]).map(p => [p.id as string, p.advisory_group_id as string | null])) as Record<string, string | null>,
                plans: (plans.data ?? []) as { id: string; group_id: string; subject_id: string | null; status: string | null }[],
                commissions: ((comm.data ?? []) as any[]).map(c => ({ ...c, members: Array.isArray(c.members) ? c.members : [] })) as Commission[],
                catalog,
                schedule: (sched.data ?? []) as Slot[],
            }
        },
    })
}
type Data = NonNullable<ReturnType<typeof useStaffData>['data']>

export const StaffControlCenter = () => {
    const { data, isLoading, error } = useStaffData()
    const qc = useQueryClient()
    const refresh = () => qc.invalidateQueries({ queryKey: [KEY] })
    const [tab, setTab] = useState<'people' | 'commissions'>('people')
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<'all' | 'teachers' | 'nocommission' | 'noclasses'>('all')
    const [openId, setOpenId] = useState<string | null>(null)
    const now = useNow()

    const stats = useMemo(() => {
        if (!data) return null
        const teachers = data.people.filter(p => p.teaches)
        return {
            staff: data.people.length,
            teachers: teachers.length,
            noCommission: teachers.filter(p => commissionsOf(data.commissions, p.id, p.name).length === 0),
            unassigned: data.groupSubjects.filter(g => !g.teacher_id).length,
        }
    }, [data])

    if (isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    if (error || !data || !stats) return <p role="alert" className="m-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudo cargar el personal: {(error as any)?.message ?? 'sin datos'}</p>

    const q = query.trim().toLowerCase()
    const shown = data.people.filter(p => {
        if (q && !`${p.name} ${p.roles.map(roleLabel).join(' ')}`.toLowerCase().includes(q)) return false
        if (filter === 'teachers') return p.teaches
        if (filter === 'nocommission') return p.teaches && commissionsOf(data.commissions, p.id, p.name).length === 0
        if (filter === 'noclasses') return p.teaches && !data.groupSubjects.some(g => g.teacher_id === p.id)
        return true
    })
    const open = data.people.find(p => p.id === openId) ?? null

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Centro de Control de Personal</h1>
                <p className="text-slate-600">Supervisión, asistencia y asignación de responsabilidades. Ciclo {data.schoolYear}.</p>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Tile icon={Users} value={stats.staff} label="Personal" onClick={() => { setTab('people'); setFilter('all') }} />
                <Tile icon={GraduationCap} value={stats.teachers} label="Docentes frente a grupo" onClick={() => { setTab('people'); setFilter('teachers') }} />
                <Tile icon={UsersRound} value={stats.noCommission.length} label="Docentes sin comisión" warn={stats.noCommission.length > 0} onClick={() => { setTab('people'); setFilter('nocommission') }} />
                <Tile icon={BookOpen} value={stats.unassigned} label="Materias sin docente" warn={stats.unassigned > 0} />
            </div>

            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Sección">
                {([['people', 'Personal', Users], ['commissions', `Comisiones (${data.commissions.length})`, ClipboardList]] as const).map(([id, label, Icon]) => (
                    <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                        className={`${btn} border-2 ${tab === id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {tab === 'people' && (
                <section className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="search" aria-label="Buscar personal" placeholder="Buscar por nombre o puesto" value={query} onChange={e => setQuery(e.target.value)} className={`${input} w-full pl-10`} />
                        </div>
                        <select aria-label="Filtrar" value={filter} onChange={e => setFilter(e.target.value as any)} className={input}>
                            <option value="all">Todo el personal</option>
                            <option value="teachers">Docentes frente a grupo</option>
                            <option value="nocommission">Docentes sin comisión</option>
                            <option value="noclasses">Docentes sin clases asignadas</option>
                        </select>
                    </div>
                    {shown.length === 0 && <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">Nadie coincide con la búsqueda.</p>}
                    <ul className="space-y-2">
                        {shown.map(p => {
                            const classes = data.groupSubjects.filter(g => g.teacher_id === p.id)
                            const groupsCount = new Set(classes.map(c => c.group_id)).size
                            const comms = commissionsOf(data.commissions, p.id, p.name)
                            const adv = data.groups.find(g => g.id === data.advisory[p.id])
                            const current = nowAndNext(slotsOfTeacher(data.schedule, data.groupSubjects, p.id), now).current
                            return (
                                <li key={p.id} className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-wrap items-center gap-3">
                                    <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center uppercase">{p.name.split(' ').slice(0, 2).map(w => w[0]).join('')}</div>
                                    <div className="min-w-0 flex-1 basis-60">
                                        <p className="font-black text-slate-900 truncate">{p.name}</p>
                                        <p className="text-sm text-slate-600">{p.roles.map(roleLabel).join(' · ')}{p.jobTitle && !p.roles.map(roleLabel).includes(p.jobTitle) ? ` · ${p.jobTitle}` : ''}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {p.teaches && <Chip tone={classes.length ? 'slate' : 'warn'}>{classes.length ? `${classes.length} clase${classes.length === 1 ? '' : 's'} en ${groupsCount} grupo${groupsCount === 1 ? '' : 's'}` : 'Sin clases asignadas'}</Chip>}
                                            {current && <Chip tone="indigo">Ahora en {groupLabel(current.assignment.groups)} · {subjectLabel(current.assignment)}</Chip>}
                                            {adv && <Chip tone="indigo">Asesora {groupLabel(adv)}</Chip>}
                                            {comms.map(c => <Chip key={c.commission.id} tone="emerald">{c.commission.name}: {c.role}</Chip>)}
                                            {p.teaches && comms.length === 0 && <Chip tone="warn">Sin comisión</Chip>}
                                        </div>
                                    </div>
                                    <button onClick={() => setOpenId(p.id)} className={`${btn} bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ml-auto`}>Gestionar</button>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )}

            {tab === 'commissions' && <CommissionsTab data={data} missing={stats.noCommission} onChanged={refresh} />}

            {open && <PersonPanel person={open} data={data} onClose={() => setOpenId(null)} onChanged={refresh} />}
        </div>
    )
}

const Tile = ({ icon: Icon, value, label, warn, onClick }: { icon: any; value: number; label: string; warn?: boolean; onClick?: () => void }) => {
    const cls = `text-left rounded-2xl border p-4 ${warn ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'} ${onClick ? 'hover:border-indigo-300 transition' : ''}`
    const body = <><Icon className={`w-5 h-5 ${warn ? 'text-amber-700' : 'text-indigo-500'}`} /><p className="text-2xl font-black text-slate-900 leading-tight mt-1">{value}</p><p className="text-xs font-bold text-slate-600">{label}</p></>
    return onClick ? <button onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>
}

const Chip = ({ tone, children }: { tone: 'slate' | 'indigo' | 'emerald' | 'warn'; children: React.ReactNode }) => (
    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${{ slate: 'bg-slate-100 text-slate-700', indigo: 'bg-indigo-50 text-indigo-700', emerald: 'bg-emerald-50 text-emerald-800', warn: 'bg-amber-100 text-amber-900' }[tone]}`}>{children}</span>
)

// ---------------------------------------------------------------- Comisiones

async function saveMembers(commission: Commission, members: Commission['members']) {
    return supabase.from('school_commissions').update({ members: sortMembers(members) } as any).eq('id', commission.id)
}

/** Selector de cargo: los habituales o uno escrito a mano. */
const CargoSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    const custom = !CARGOS.includes(value)
    return (
        <span className="inline-flex gap-2">
            <select aria-label="Cargo" value={custom ? '__otro' : value} onChange={e => onChange(e.target.value === '__otro' ? '' : e.target.value)} className={input}>
                {CARGOS.map(c => <option key={c}>{c}</option>)}
                <option value="__otro">Otro cargo…</option>
            </select>
            {custom && <input aria-label="Nombre del cargo" placeholder="Escribe el cargo" value={value} onChange={e => onChange(e.target.value)} className={`${input} w-40`} maxLength={40} />}
        </span>
    )
}

const CommissionsTab = ({ data, missing, onChanged }: { data: Data; missing: Person[]; onChanged: () => void }) => {
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const existing = new Set(data.commissions.map(c => c.name.toLowerCase()))
    const suggestions = SUGGESTED_COMMISSIONS.filter(s => !existing.has(s.toLowerCase()))

    const create = async (names: string[]) => {
        const rows = names.map(n => n.trim()).filter(n => n && !existing.has(n.toLowerCase())).map(n => ({ tenant_id: data.tenantId, school_year: data.schoolYear, name: n, members: [], source: 'Dirección' }))
        if (!rows.length) return setErr('Esa comisión ya existe.')
        setBusy(true); setErr(null)
        const { error } = await supabase.from('school_commissions').insert(rows as any)
        setBusy(false)
        if (error) return setErr(error.message)
        setName(''); onChanged()
    }

    return (
        <section className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3">
                <h2 className="font-black text-slate-900">Nueva comisión</h2>
                <p className="text-sm text-slate-600">Las comisiones se nombran en el CTE intensivo de inicio de ciclo. Cada docente debe estar en al menos una.</p>
                {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {suggestions.map(s => <button key={s} onClick={() => create([s])} disabled={busy} className={`${btn} bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}><Plus className="w-4 h-4" /> {s}</button>)}
                        {suggestions.length > 1 && <button onClick={() => create(suggestions)} disabled={busy} className={`${btn} border border-slate-200 text-slate-700`}>Crear todas</button>}
                    </div>
                )}
                <form onSubmit={e => { e.preventDefault(); void create([name]) }} className="flex flex-col sm:flex-row gap-2">
                    <input aria-label="Nombre de la comisión" placeholder="Otra comisión (por ejemplo, Lectura o Cooperativa escolar)" value={name} onChange={e => setName(e.target.value)} className={`${input} flex-1`} maxLength={80} />
                    <button type="submit" disabled={busy || name.trim().length < 3} className={`${btn} bg-indigo-600 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear</button>
                </form>
                {err && <p role="alert" className="text-sm font-bold text-rose-700">{err}</p>}
            </div>

            {missing.length > 0 && (
                <p className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span><b>{missing.length} docente{missing.length === 1 ? '' : 's'} sin comisión:</b> {missing.map(p => p.name).join(', ')}.</span>
                </p>
            )}

            {data.commissions.length === 0 && <p className="bg-white border border-slate-200 rounded-3xl py-12 text-center text-slate-600 font-bold">Todavía no hay comisiones en este ciclo.</p>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.commissions.map(c => <CommissionCard key={c.id} commission={c} data={data} onChanged={onChanged} />)}
            </div>
        </section>
    )
}

const CommissionCard = ({ commission, data, onChanged }: { commission: Commission; data: Data; onChanged: () => void }) => {
    const [personId, setPersonId] = useState('')
    const [cargo, setCargo] = useState('Vocal')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const members = sortMembers(commission.members)

    const run = async (action: () => PromiseLike<{ error: any }>) => {
        setBusy(true); setErr(null)
        const { error } = await action()
        setBusy(false)
        if (error) return setErr(error.message)
        onChanged()
    }
    const add = async () => {
        const p = data.people.find(x => x.id === personId)
        if (!p) return setErr('Elige a una persona.')
        const role = cargo.trim() || 'Integrante'
        const taken = takenUniqueCargo(commission, role, p.id, p.name)
        if (taken && !(await askConfirm(`${taken.name} ya es ${role} de esta comisión. ¿Nombrar también a ${p.name} con ese cargo?`))) return
        await run(() => saveMembers(commission, upsertMember(commission.members, p.id, p.name, role)))
        setPersonId('')
    }
    const remove = async () => {
        if (!(await askConfirm(`¿Eliminar la comisión "${commission.name}" y sus ${members.length} integrante(s)?`, { danger: true, confirmLabel: 'Eliminar' } as any))) return
        await run(() => supabase.from('school_commissions').delete().eq('id', commission.id))
    }

    return (
        <article className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <h3 className="font-black text-slate-900">{commission.name} <span className="text-sm font-bold text-slate-500">· {members.length} integrante{members.length === 1 ? '' : 's'}</span></h3>
                <button onClick={remove} disabled={busy} aria-label={`Eliminar la comisión ${commission.name}`} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
            </div>
            {members.length === 0 ? <p className="text-sm text-slate-500">Sin integrantes todavía.</p> : (
                <ul className="divide-y divide-slate-100">
                    {members.map((m, i) => (
                        <li key={`${m.profile_id ?? m.name}-${i}`} className="py-2 flex items-center gap-2">
                            <span className="text-xs font-black text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1 shrink-0">{m.role}</span>
                            <span className="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate">{m.name}</span>
                            <button onClick={() => run(() => saveMembers(commission, removeMember(commission.members, m.profile_id ?? '', m.name)))} disabled={busy}
                                aria-label={`Quitar a ${m.name}`} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><X className="w-4 h-4" /></button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
                <select aria-label={`Persona para ${commission.name}`} value={personId} onChange={e => setPersonId(e.target.value)} className={`${input} flex-1 min-w-44`}>
                    <option value="">Agregar a…</option>
                    {data.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <CargoSelect value={cargo} onChange={setCargo} />
                <button onClick={add} disabled={busy || !personId} className={`${btn} bg-indigo-600 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar</button>
            </div>
            {err && <p role="alert" className="text-sm font-bold text-rose-700">{err}</p>}
        </article>
    )
}

// ---------------------------------------------------------------- Una persona

const SECTIONS = ['schedule', 'classes', 'advisory', 'commissions', 'plans'] as const

const PersonPanel = ({ person, data, onClose, onChanged }: { person: Person; data: Data; onClose: () => void; onChanged: () => void }) => {
    const acc = useAccordion(SECTIONS)
    const fold = (id: typeof SECTIONS[number]) => ({ open: acc.isOpen(id), onToggle: () => acc.toggle(id) })
    const [groupId, setGroupId] = useState('')
    const [subjectId, setSubjectId] = useState('')
    const [commissionId, setCommissionId] = useState('')
    const [newCommission, setNewCommission] = useState('')
    const [cargo, setCargo] = useState('Vocal')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const classes = data.groupSubjects.filter(g => g.teacher_id === person.id)
        .sort((a, b) => groupLabel(a.groups).localeCompare(groupLabel(b.groups)) || subjectLabel(a).localeCompare(subjectLabel(b), 'es'))
    const comms = commissionsOf(data.commissions, person.id, person.name)
    const now = useNow()
    const mySlots = slotsOfTeacher(data.schedule, data.groupSubjects, person.id)
    const { current, next } = nowAndNext(mySlots, now)
    const advisory = data.advisory[person.id] ?? ''
    const plans = data.plans.filter(p => classes.some(c => c.group_id === p.group_id && c.subject_catalog_id === p.subject_id))
    const nameOf = (id: string | null) => data.people.find(p => p.id === id)?.name ?? 'otra persona'

    // Materias que se pueden asignar en el grupo elegido: primero las que el grupo ya tiene
    const inGroup = data.groupSubjects.filter(g => g.group_id === groupId && g.subject_catalog_id)
    const options = groupId ? [
        ...inGroup.map(g => ({ id: g.subject_catalog_id!, label: `${subjectLabel(g)}${g.teacher_id === person.id ? ' (ya la imparte)' : g.teacher_id ? ` (hoy: ${nameOf(g.teacher_id)})` : ' (sin docente)'}` })),
        ...data.catalog.filter(c => !inGroup.some(g => g.subject_catalog_id === c.id || subjectLabel(g).toLowerCase() === c.name.toLowerCase())).map(c => ({ id: c.id, label: `${c.name} (nueva en el grupo)` })),
    ] : []

    const run = async (action: () => PromiseLike<{ error: any }>, ok: string) => {
        setBusy(true); setMsg(null)
        const { error } = await action()
        setBusy(false)
        if (error) return setMsg({ ok: false, text: error.message })
        setMsg({ ok: true, text: ok }); onChanged()
    }

    const assignClass = async () => {
        if (!groupId || !subjectId) return setMsg({ ok: false, text: 'Elige el grupo y la materia.' })
        const existing = data.groupSubjects.find(g => g.group_id === groupId && g.subject_catalog_id === subjectId)
        const label = `${options.find(o => o.id === subjectId)?.label.replace(/ \(.*\)$/, '') ?? 'la materia'} en ${groupLabel(data.groups.find(g => g.id === groupId))}`
        if (existing?.teacher_id === person.id) return setMsg({ ok: false, text: 'Ya imparte esa materia en ese grupo.' })
        if (existing?.teacher_id && !(await askConfirm(`${label} la imparte ${nameOf(existing.teacher_id)}. ¿Asignarla ahora a ${person.name}?`))) return
        await run(() => existing
            ? supabase.from('group_subjects').update({ teacher_id: person.id }).eq('id', existing.id)
            : supabase.from('group_subjects').insert({ tenant_id: data.tenantId, group_id: groupId, subject_catalog_id: subjectId, teacher_id: person.id } as any),
            `Asignada: ${label}.`)
        setSubjectId('')
    }
    const unassign = async (gs: GroupSubject) => {
        if (!(await askConfirm(`¿Quitar a ${person.name} de ${subjectLabel(gs)} en ${groupLabel(gs.groups)}? La materia queda en el grupo, sin docente.`))) return
        await run(() => supabase.from('group_subjects').update({ teacher_id: null }).eq('id', gs.id), 'Clase retirada; la materia quedó sin docente.')
    }
    const setAdvisory = (value: string) => run(() => supabase.rpc('set_advisory_group' as any, { p_profile: person.id, p_group: value || null }), value ? 'Asesoría actualizada.' : 'Asesoría retirada.')
    const NEW = '__nueva'
    const addCommission = async () => {
        const role = cargo.trim() || 'Integrante'
        // Comisión que todavía no existe en la escuela: se crea y se le asigna de una vez
        if (commissionId === NEW) {
            const name = newCommission.trim().replace(/\s+/g, ' ')
            if (name.length < 3) return setMsg({ ok: false, text: 'Escribe el nombre de la nueva comisión.' })
            const same = data.commissions.find(c => c.name.toLowerCase() === name.toLowerCase())
            if (same) {
                await run(() => saveMembers(same, upsertMember(same.members, person.id, person.name, role)), `Esa comisión ya existía: ${person.name} quedó como ${role} de ${same.name}.`)
            } else {
                await run(() => supabase.from('school_commissions').insert({
                    tenant_id: data.tenantId, school_year: data.schoolYear, name, source: 'Dirección',
                    members: [{ profile_id: person.id, name: person.name, role }],
                } as any), `Se creó la comisión "${name}" y ${person.name} quedó como ${role}.`)
            }
            setCommissionId(''); setNewCommission('')
            return
        }
        const c = data.commissions.find(x => x.id === commissionId)
        if (!c) return setMsg({ ok: false, text: 'Elige una comisión.' })
        const taken = takenUniqueCargo(c, role, person.id, person.name)
        if (taken && !(await askConfirm(`${taken.name} ya es ${role} de ${c.name}. ¿Nombrar también a ${person.name} con ese cargo?`))) return
        await run(() => saveMembers(c, upsertMember(c.members, person.id, person.name, role)), `${person.name} quedó como ${role} de ${c.name}.`)
        setCommissionId('')
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="pp-title" onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] flex flex-col">
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 id="pp-title" className="text-xl font-black text-slate-900 truncate">{person.name}</h2>
                        <p className="text-sm text-slate-600">{person.roles.map(roleLabel).join(' · ')}</p>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-5 space-y-3 overflow-y-auto">
                    <div className="flex justify-end -mt-2 -mb-1"><AccordionToggleAll acc={acc} /></div>
                    {msg && <p role={msg.ok ? 'status' : 'alert'} className={`flex items-start gap-2 text-sm font-bold rounded-2xl px-4 py-3 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}{msg.text}</p>}

                    <AccordionSection title="Horario" {...fold('schedule')} summary={current ? `Ahora en ${groupLabel(current.assignment.groups)} · ${subjectLabel(current.assignment)}` : next ? `Sin clase ahora · sigue ${groupLabel(next.assignment.groups)} a las ${hhmm(next.slot.start_time)}` : mySlots.length ? `${mySlots.length} clases a la semana · sin clase ahora` : 'Sin horario'}>
                            {mySlots.length === 0 ? (
                                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{data.schedule.length === 0 ? 'La escuela todavía no ha armado su horario de clases.' : classes.length === 0 ? 'No tiene clases asignadas, por eso no aparece en el horario.' : 'Sus clases todavía no están colocadas en el horario de la escuela.'}</p>
                            ) : (
                                <>
                                    <p role="status" className={`text-sm font-bold rounded-2xl px-4 py-3 mb-3 ${current ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50 text-slate-700'}`}>
                                        {current
                                            ? <>En este momento está con <span className="font-black">{groupLabel(current.assignment.groups)}</span> en {subjectLabel(current.assignment)} ({hhmm(current.slot.start_time)} a {hhmm(current.slot.end_time)}).</>
                                            : <>En este momento no tiene clase.</>}
                                        {next && <> {current ? 'Después' : 'Su siguiente clase de hoy'}: {groupLabel(next.assignment.groups)}, {subjectLabel(next.assignment)}, a las {hhmm(next.slot.start_time)}.</>}
                                        {!current && !next && <> Hoy ya no tiene más clases.</>}
                                    </p>
                                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {WEEK.filter(([d]) => mySlots.some(m => m.slot.day_of_week === d)).map(([d, label]) => (
                                            <div key={d} className="border border-slate-200 rounded-2xl p-3">
                                                <p className="text-xs font-black text-slate-500 uppercase mb-1.5">{label}</p>
                                                <ul className="space-y-1">
                                                    {mySlots.filter(m => m.slot.day_of_week === d).map(m => (
                                                        <li key={m.slot.id} className={`flex items-center gap-2 text-sm rounded-lg px-1.5 py-1 ${current?.slot.id === m.slot.id ? 'bg-indigo-50' : ''}`}>
                                                            <span className="font-bold text-slate-600 tabular-nums shrink-0">{hhmm(m.slot.start_time)}–{hhmm(m.slot.end_time)}</span>
                                                            <span className="text-xs font-black bg-slate-100 text-slate-800 rounded-md px-1.5 py-0.5 shrink-0">{groupLabel(m.assignment.groups)}</span>
                                                            <span className="font-bold text-slate-800 truncate">{subjectLabel(m.assignment)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                    </AccordionSection>

                    <AccordionSection title="Clases que imparte" {...fold('classes')} tone={classes.length ? 'normal' : 'warn'} summary={classes.length ? `${classes.length} en ${new Set(classes.map(c => c.group_id)).size} ${new Set(classes.map(c => c.group_id)).size === 1 ? 'grupo' : 'grupos'}` : 'Sin clases asignadas'}>
                            {classes.length === 0 ? <p className="text-sm text-slate-500 mb-3">No tiene clases asignadas.</p> : (
                                <ul className="grid sm:grid-cols-2 gap-2 mb-3">
                                    {classes.map(c => (
                                        <li key={c.id} className="flex items-center gap-2 border border-slate-200 rounded-2xl px-3 py-2">
                                            <span className="text-xs font-black bg-slate-100 text-slate-800 rounded-lg px-2 py-1 shrink-0">{groupLabel(c.groups)}</span>
                                            <span className="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate">{subjectLabel(c)}</span>
                                            <button onClick={() => unassign(c)} disabled={busy} aria-label={`Quitar ${subjectLabel(c)} de ${groupLabel(c.groups)}`} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><X className="w-4 h-4" /></button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex flex-wrap gap-2 bg-slate-50 rounded-2xl p-3">
                                <select aria-label="Grupo" value={groupId} onChange={e => { setGroupId(e.target.value); setSubjectId('') }} className={input}>
                                    <option value="">Grupo…</option>
                                    {data.groups.map(g => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
                                </select>
                                <select aria-label="Materia" value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!groupId} className={`${input} flex-1 min-w-48 disabled:opacity-50`}>
                                    <option value="">{groupId ? 'Materia…' : 'Primero elige el grupo'}</option>
                                    {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                </select>
                                <button onClick={assignClass} disabled={busy || !groupId || !subjectId} className={`${btn} bg-indigo-600 text-white`}><Plus className="w-4 h-4" /> Asignar clase</button>
                            </div>
                    </AccordionSection>

                    <AccordionSection title="Asesoría de grupo" {...fold('advisory')} summary={advisory ? groupLabel(data.groups.find(g => g.id === advisory)) : 'Sin grupo'}>
                            <select aria-label="Grupo que asesora" value={advisory} onChange={e => setAdvisory(e.target.value)} disabled={busy} className={input}>
                                <option value="">Sin grupo de asesoría</option>
                                {data.groups.map(g => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
                            </select>
                    </AccordionSection>

                    <AccordionSection title="Comisiones" {...fold('commissions')} tone={comms.length ? 'normal' : 'warn'} summary={comms.length ? comms.map(c => `${c.commission.name}: ${c.role}`).join(' · ') : 'Sin comisión'}>
                            {comms.length === 0 ? <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mb-3">No está en ninguna comisión. Cada docente debe estar en al menos una.</p> : (
                                <ul className="space-y-2 mb-3">
                                    {comms.map(({ commission, role }) => (
                                        <li key={commission.id} className="flex items-center gap-2 border border-slate-200 rounded-2xl px-3 py-2">
                                            <span className="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate">{commission.name}</span>
                                            <span className="text-xs font-black text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1">{role}</span>
                                            <button onClick={() => run(() => saveMembers(commission, removeMember(commission.members, person.id, person.name)), `Se quitó de ${commission.name}.`)} disabled={busy}
                                                aria-label={`Quitar de ${commission.name}`} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><X className="w-4 h-4" /></button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex flex-wrap gap-2 bg-slate-50 rounded-2xl p-3">
                                <select aria-label="Comisión" value={commissionId} onChange={e => setCommissionId(e.target.value)} className={`${input} flex-1 min-w-44`}>
                                    <option value="">Comisión…</option>
                                    {data.commissions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    <option value={NEW}>Otra comisión…</option>
                                </select>
                                {commissionId === NEW && <input aria-label="Nombre de la nueva comisión" placeholder="Nombre de la nueva comisión" value={newCommission} onChange={e => setNewCommission(e.target.value)} className={`${input} flex-1 min-w-44`} maxLength={80} autoFocus />}
                                <CargoSelect value={cargo} onChange={setCargo} />
                                <button onClick={addCommission} disabled={busy || !commissionId || (commissionId === NEW && newCommission.trim().length < 3)} className={`${btn} bg-indigo-600 text-white`}><Plus className="w-4 h-4" /> Asignar</button>
                            </div>
                    </AccordionSection>

                    <AccordionSection title="Planeaciones" {...fold('plans')} summary={plans.length ? `${plans.length} ${plans.length === 1 ? 'registrada' : 'registradas'} · ${plans.filter(p => p.status === 'APPROVED').length} aprobadas` : 'Ninguna registrada'}>
                            {plans.length === 0 ? <p className="text-sm text-slate-500">Aún no hay planeaciones registradas para sus grupos y materias.</p> : (
                                <dl className="grid grid-cols-3 gap-2 text-center">
                                    {([['APPROVED', 'Aprobadas'], ['SUBMITTED', 'Entregadas'], ['DRAFT', 'En borrador']] as const).map(([s, label]) => (
                                        <div key={s} className="bg-slate-50 rounded-2xl py-3"><dd className="text-xl font-black text-slate-900">{plans.filter(p => (p.status ?? 'DRAFT') === s).length}</dd><dt className="text-xs font-bold text-slate-600">{label}</dt></div>
                                    ))}
                                </dl>
                            )}
                    </AccordionSection>
                </div>
            </div>
        </div>
    )
}
