import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, CheckCircle2, CalendarX } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { toLocalISODate } from '../../../../lib/dates'
import { groupBySubject, shortDate, shortTitle, subjectOf } from '../tutor/groupBySubject'

type LowGrade = { id: string; score: number; date: string | null; title: string; subject: string }
type Absence = { id: string; date: string; status: 'LATE' | 'ABSENT'; notes: string | null }

const VISIBLE_GROUPS = 3

/**
 * Alertas académicas en forma compacta: una fila por materia con calificaciones bajas
 * ("Matemáticas · 3 calificaciones bajas · 4.4 · 5 · 4.4") y una fila de faltas y retardos
 * de las últimas 2 semanas. Al tocar una fila se ve el detalle.
 */
export const AcademicAlerts = ({ studentId }: { studentId: string }) => {
    const [grades, setGrades] = useState<LowGrade[]>([])
    const [absences, setAbsences] = useState<Absence[]>([])
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState<string | null>(null)
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        if (!studentId) return
        let off = false
        setLoading(true)
        setOpen(null)
        setShowAll(false)
        ;(async () => {
            try {
                const twoWeeksAgo = new Date()
                twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
                const [att, low] = await Promise.all([
                    supabase.from('attendance').select('id, date, status, notes')
                        .eq('student_id', studentId).in('status', ['LATE', 'ABSENT'])
                        .gte('date', toLocalISODate(twoWeeksAgo)).order('date', { ascending: false }),
                    supabase.from('grades')
                        .select('id, score, graded_at, created_at, assignment:assignments(title, due_date, subject:subject_catalog(name))')
                        .eq('student_id', studentId).not('score', 'is', null).lt('score', 6)
                        .order('created_at', { ascending: false }).limit(40),
                ])
                if (off) return
                setAbsences(((att.data as any[]) ?? []) as Absence[])
                setGrades(((low.data as any[]) ?? []).map(g => {
                    const subject = subjectOf(g.assignment?.title, g.assignment?.subject?.name)
                    return {
                        id: g.id, score: Number(g.score), subject,
                        title: shortTitle(g.assignment?.title ?? 'Actividad', subject),
                        date: g.graded_at ?? g.assignment?.due_date ?? g.created_at ?? null,
                    }
                }))
            } catch (error) {
                console.error('Error loading alerts:', error)
            } finally {
                if (!off) setLoading(false)
            }
        })()
        return () => { off = true }
    }, [studentId])

    if (loading) return <div className="animate-pulse h-16 bg-slate-100 rounded-2xl" />

    if (!grades.length && !absences.length) {
        return (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <p className="text-sm font-bold text-emerald-900">Sin alertas académicas recientes.</p>
            </div>
        )
    }

    const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
    const gradeGroups = groupBySubject(grades, g => g.subject)
        .sort((a, b) => b.items.length - a.items.length || a.subject.localeCompare(b.subject))
    const absent = absences.filter(a => a.status === 'ABSENT').length
    const late = absences.length - absent

    type Row = { key: string; title: string; summary: string; detail: { id: string; left: string; right: string }[]; tone: 'rose' | 'amber' }
    const rows: Row[] = []
    if (absences.length) rows.push({
        key: '__asistencia', tone: 'amber', title: 'Asistencia (últimas 2 semanas)',
        summary: [absent ? `${absent} ${absent === 1 ? 'falta' : 'faltas'}` : null, late ? `${late} ${late === 1 ? 'retardo' : 'retardos'}` : null].filter(Boolean).join(' y '),
        detail: absences.map(a => ({ id: a.id, left: `${a.status === 'ABSENT' ? 'Falta' : 'Retardo'}${a.notes ? ` · ${a.notes}` : ''}`, right: shortDate(a.date) })),
    })
    for (const g of gradeGroups) rows.push({
        key: g.subject, tone: 'rose', title: g.subject,
        summary: `${g.items.length === 1 ? '1 calificación baja' : `${g.items.length} calificaciones bajas`}: ${g.items.slice(0, 4).map(i => fmtScore(i.score)).join(' · ')}${g.items.length > 4 ? '…' : ''}`,
        detail: g.items.map(i => ({ id: i.id, left: `${i.title}: ${fmtScore(i.score)}`, right: shortDate(i.date) })),
    })
    const shown = showAll ? rows : rows.slice(0, VISIBLE_GROUPS)

    return (
        <div className="rounded-2xl bg-white border border-rose-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border-b border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <h3 className="flex-1 font-black text-rose-900 text-sm md:text-base">Alertas académicas</h3>
                <span className="text-xs font-bold text-rose-700">
                    {[grades.length ? `${grades.length} ${grades.length === 1 ? 'calificación baja' : 'calificaciones bajas'}` : null,
                      absences.length ? `${absences.length} ${absences.length === 1 ? 'falta/retardo' : 'faltas/retardos'}` : null].filter(Boolean).join(' · ')}
                </span>
            </div>
            <div className="divide-y divide-slate-100">
                {shown.map(r => {
                    const isOpen = open === r.key
                    return (
                        <div key={r.key}>
                            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.key)}
                                className="w-full min-h-[52px] flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                                {r.key === '__asistencia'
                                    ? <CalendarX className="w-4 h-4 text-amber-700 shrink-0" />
                                    : <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-black text-slate-900 truncate">{r.title}</span>
                                    <span className={`block text-xs font-bold ${r.tone === 'rose' ? 'text-rose-700' : 'text-amber-800'}`}>{r.summary}</span>
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && (
                                <ul className="px-4 pb-3 space-y-1.5">
                                    {r.detail.map(d => (
                                        <li key={d.id} className="flex items-baseline gap-2 text-sm">
                                            <span className="flex-1 min-w-0 text-slate-800 font-semibold">{d.left}</span>
                                            <span className="shrink-0 text-xs font-bold text-slate-500">{d.right}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )
                })}
            </div>
            {rows.length > VISIBLE_GROUPS && (
                <button type="button" onClick={() => setShowAll(v => !v)}
                    className="w-full min-h-[44px] border-t border-slate-100 text-sm font-black text-indigo-700 hover:bg-indigo-50">
                    {showAll ? 'Ver menos' : `Ver todo (${rows.length})`}
                </button>
            )}
        </div>
    )
}
