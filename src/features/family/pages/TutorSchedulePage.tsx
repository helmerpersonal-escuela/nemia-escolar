import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, Clock, Megaphone, AlertTriangle, BookOpen } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { fetchSpecialDays, isoDate, MODE_LABEL, specialFor, type SpecialDay } from '../../../lib/specialDays'

/**
 * Pestaña "Horario" del tutor: el horario de clases de su hijo(a) y, arriba, los avisos de la escuela
 * (comunicados, días sin clases u horario especial, fechas importantes). El tutor no lleva agenda propia.
 */

type Child = { id: string; first_name: string; last_name_paternal: string; group_id: string | null; group?: { grade: number; section: string } | null }
type Slot = { id: string; day_of_week: string; start_time: string; end_time: string; custom_subject: string | null; subject: { name: string } | null }
type Notice = { key: string; kind: 'special' | 'event' | 'announcement'; date: string; title: string; detail?: string | null; tone: 'red' | 'amber' | 'indigo'; isNew?: boolean }

const DAYS = [
    { key: 'MONDAY', short: 'Lun', long: 'Lunes' },
    { key: 'TUESDAY', short: 'Mar', long: 'Martes' },
    { key: 'WEDNESDAY', short: 'Mié', long: 'Miércoles' },
    { key: 'THURSDAY', short: 'Jue', long: 'Jueves' },
    { key: 'FRIDAY', short: 'Vie', long: 'Viernes' },
]
const SEEN_KEY = 'vunlek_tutor_avisos_vistos'
const hhmm = (t: string) => t?.slice(0, 5)
const fmt = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

export function TutorSchedulePage() {
    const { data: tenant } = useTenant()
    const [children, setChildren] = useState<Child[]>([])
    const [childId, setChildId] = useState<string | null>(null)
    const [slots, setSlots] = useState<Slot[]>([])
    const [specials, setSpecials] = useState<SpecialDay[]>([])
    const [notices, setNotices] = useState<Notice[]>([])
    const [loading, setLoading] = useState(true)

    // Lunes de esta semana (en fin de semana, la siguiente) y el día seleccionado
    const today = new Date()
    const dow = today.getDay() // 0 domingo … 6 sábado
    const monday = addDays(today, dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow)
    const weekDates = DAYS.map((_, i) => isoDate(addDays(monday, i)))
    const [dayIdx, setDayIdx] = useState(dow >= 1 && dow <= 5 ? dow - 1 : 0)

    // Hijos del tutor
    useEffect(() => {
        let off = false
        ;(async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase.from('guardians')
                .select('student:students(id, first_name, last_name_paternal, group_id, group:groups(grade, section))')
                .eq('user_id', user.id)
            if (off) return
            const list = ((data as any[]) ?? []).map(g => g.student).filter(Boolean) as Child[]
            setChildren(list)
            let saved: string | null = null
            try { saved = sessionStorage.getItem('vunlek_tutor_horario_hijo') } catch { /* sin almacenamiento */ }
            setChildId(list.find(c => c.id === saved)?.id ?? list[0]?.id ?? null)
            if (!list.length) setLoading(false)
        })()
        return () => { off = true }
    }, [])

    const child = useMemo(() => children.find(c => c.id === childId) ?? null, [children, childId])

    // Horario del grupo + avisos de la escuela
    useEffect(() => {
        if (!tenant?.id || !child) return
        let off = false
        setLoading(true)
        try { sessionStorage.setItem('vunlek_tutor_horario_hijo', child.id) } catch { /* sin almacenamiento */ }
        const from = isoDate(new Date())
        const to = isoDate(addDays(new Date(), 30))
        ;(async () => {
            const [sched, spec, events, ann] = await Promise.all([
                child.group_id
                    ? supabase.from('schedules').select('id, day_of_week, start_time, end_time, custom_subject, subject:subject_catalog(name)').eq('group_id', child.group_id).order('start_time')
                    : Promise.resolve({ data: [] as any[] }),
                fetchSpecialDays(tenant.id, from, to),
                supabase.from('calendar_events').select('id, title, description, start_date, end_date, is_official_sep')
                    .or(`tenant_id.eq.${tenant.id},is_official_sep.eq.true`).gte('end_date', from).lte('start_date', to).order('start_date').limit(8),
                supabase.from('school_announcements').select('id, title, content, created_at, target_groups')
                    .eq('tenant_id', tenant.id).gte('created_at', addDays(new Date(), -30).toISOString()).order('created_at', { ascending: false }).limit(10),
            ])
            if (off) return
            setSlots(((sched as any).data ?? []) as Slot[])
            setSpecials(spec)
            let seen = 0
            try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0 } catch { /* sin almacenamiento */ }
            const list: Notice[] = [
                ...spec.map(s => ({
                    key: 's' + s.id, kind: 'special' as const, date: s.target_date, tone: s.mode === 'NO_CLASSES' ? 'red' as const : 'amber' as const,
                    title: `${MODE_LABEL[s.mode]}: ${s.name}`,
                    detail: [s.target_date !== s.end_date ? `Hasta el ${fmt(s.end_date)}` : null, s.mode === 'SHORTENED' && s.start_time && s.end_time ? `Horario de ${s.start_time} a ${s.end_time}` : null, s.note].filter(Boolean).join(' · ') || null,
                })),
                ...(((ann as any).data ?? []) as any[])
                    .filter(a => !a.target_groups?.length || (child.group_id && a.target_groups.includes(child.group_id)))
                    .map(a => ({ key: 'a' + a.id, kind: 'announcement' as const, date: a.created_at, tone: 'indigo' as const, title: a.title, detail: a.content, isNew: new Date(a.created_at).getTime() > seen })),
                ...(((events as any).data ?? []) as any[]).map(e => ({
                    key: 'e' + e.id, kind: 'event' as const, date: e.start_date, tone: 'amber' as const, title: e.title,
                    detail: [e.end_date && e.end_date !== e.start_date ? `Hasta el ${fmt(e.end_date)}` : null, e.description].filter(Boolean).join(' · ') || null,
                })),
            ]
            setNotices(list)
            setLoading(false)
            try { localStorage.setItem(SEEN_KEY, String(Date.now())) } catch { /* sin almacenamiento */ }
        })()
        return () => { off = true }
    }, [tenant?.id, child])

    if (!loading && !children.length) {
        return <div className="p-6 text-center text-slate-600 font-bold">Aún no ligas a tu hijo(a). Escribe el código de la escuela desde Inicio.</div>
    }

    const day = DAYS[dayIdx]
    const date = weekDates[dayIdx]
    const special = specialFor(specials, date)
    const daySlots = slots.filter(s => s.day_of_week === day.key)
    const nowMin = today.getHours() * 60 + today.getMinutes()
    const isToday = date === isoDate(today)
    const urgent = notices.filter(n => n.kind === 'special' || n.isNew)
    const toneCls = { red: 'bg-rose-50 border-rose-200 text-rose-900', amber: 'bg-amber-50 border-amber-200 text-amber-900', indigo: 'bg-indigo-50 border-indigo-100 text-indigo-900' }

    return (
        <div className="max-w-2xl mx-auto px-3 md:px-4 pb-24 space-y-4">
            {/* Encabezado y selector de hijo */}
            <div className="flex flex-wrap items-end justify-between gap-2">
                <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">Horario y avisos</h1>
                {child?.group && <span className="text-sm font-bold text-slate-500">{child.group.grade}° "{child.group.section}"</span>}
            </div>
            {children.length > 1 && (
                <div role="tablist" aria-label="Mis hijos" className="flex gap-2 overflow-x-auto pb-1">
                    {children.map(c => (
                        <button key={c.id} role="tab" aria-selected={c.id === childId} onClick={() => setChildId(c.id)}
                            className={`shrink-0 min-h-[40px] px-4 rounded-2xl text-sm font-black border ${c.id === childId ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>
                            {cap(c.first_name)}
                        </button>
                    ))}
                </div>
            )}

            {/* Avisos de la escuela */}
            <section aria-label="Avisos de la escuela" className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                <h2 className="font-black text-slate-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-rose-500" /> Avisos de la escuela
                    {urgent.length > 0 && <span className="ml-auto text-xs font-black bg-rose-500 text-white rounded-full px-2 py-0.5">{urgent.length} importante{urgent.length === 1 ? '' : 's'}</span>}
                </h2>
                {loading ? <p className="text-sm text-slate-500">Revisando…</p>
                    : notices.length === 0 ? <p className="text-sm text-slate-500">Sin avisos por ahora. Aquí verás comunicados, días sin clases y fechas importantes.</p>
                        : (
                            <ul className="space-y-2">
                                {notices.map(n => (
                                    <li key={n.key} className={`rounded-xl border px-3 py-2.5 ${toneCls[n.tone]}`}>
                                        <p className="flex items-start gap-2 text-sm font-bold">
                                            {n.kind === 'special' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : n.kind === 'announcement' ? <Megaphone className="w-4 h-4 mt-0.5 shrink-0" /> : <CalendarDays className="w-4 h-4 mt-0.5 shrink-0" />}
                                            <span className="flex-1">{n.title}</span>
                                            {n.isNew && <span className="text-[10px] font-black uppercase bg-rose-500 text-white rounded-full px-2 py-0.5">Nuevo</span>}
                                        </p>
                                        <p className="text-xs mt-0.5 pl-6 opacity-80">
                                            {n.kind === 'announcement' ? `Comunicado del ${fmt(n.date)}` : fmt(n.date)}{n.detail ? ` · ${n.detail}` : ''}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
            </section>

            {/* Horario de clases */}
            <section aria-label="Horario de clases" className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                <h2 className="font-black text-slate-900 flex items-center gap-2"><Clock className="w-5 h-5 text-indigo-600" /> Horario de {child ? cap(child.first_name) : 'tu hijo(a)'}</h2>
                <div role="tablist" aria-label="Día de la semana" className="grid grid-cols-5 gap-1.5">
                    {DAYS.map((d, i) => {
                        const sp = specialFor(specials, weekDates[i])
                        return (
                            <button key={d.key} role="tab" aria-selected={i === dayIdx} onClick={() => setDayIdx(i)}
                                className={`relative min-h-[48px] rounded-xl text-xs font-black flex flex-col items-center justify-center border ${i === dayIdx ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-100'}`}>
                                {d.short}
                                <span className={`font-bold ${i === dayIdx ? 'text-indigo-100' : 'text-slate-500'}`}>{Number(weekDates[i].slice(8))}</span>
                                {sp && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" aria-label="Día especial" />}
                            </button>
                        )
                    })}
                </div>

                {special && (
                    <p className={`rounded-xl border px-3 py-2 text-sm font-bold ${special.mode === 'NO_CLASSES' ? toneCls.red : toneCls.amber}`}>
                        {MODE_LABEL[special.mode]}: {special.name}{special.note ? ` · ${special.note}` : ''}
                    </p>
                )}

                {loading ? <p className="text-sm text-slate-500">Cargando horario…</p>
                    : special?.mode === 'NO_CLASSES' ? <p className="text-sm text-slate-600">No hay clases este día.</p>
                        : daySlots.length === 0 ? (
                            <p className="text-sm text-slate-500 flex items-center gap-2"><BookOpen className="w-4 h-4" /> La escuela aún no ha cargado el horario de este día.</p>
                        ) : (
                            <ol className="divide-y divide-slate-100">
                                {daySlots.map(s => {
                                    const now = isToday && nowMin >= toMinutes(s.start_time) && nowMin < toMinutes(s.end_time)
                                    return (
                                        <li key={s.id} className={`flex items-center gap-3 py-2.5 ${now ? 'bg-indigo-50 -mx-2 px-2 rounded-xl' : ''}`}>
                                            <span className="w-24 shrink-0 text-xs font-bold text-slate-500 tabular-nums">{hhmm(s.start_time)}–{hhmm(s.end_time)}</span>
                                            <span className="flex-1 text-sm font-bold text-slate-900">{cap(s.subject?.name || s.custom_subject || 'Clase')}</span>
                                            {now && <span className="text-[10px] font-black uppercase text-indigo-700">Ahora</span>}
                                        </li>
                                    )
                                })}
                            </ol>
                        )}
                <p className="text-xs text-slate-500">{day.long} {fmt(date).replace(/^\S+\s/, '')}</p>
            </section>
        </div>
    )
}

function toMinutes(t: string) { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0) }
