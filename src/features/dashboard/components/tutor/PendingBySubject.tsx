import { useState } from 'react'
import { ChevronDown, CheckCircle2 } from 'lucide-react'
import { groupBySubject, shortDate, shortTitle, subjectOf } from './groupBySubject'

type Pending = { id: string; title: string; due_date: string; subject?: { name?: string | null } | null }

const VISIBLE_GROUPS = 4

/**
 * Actividades sin entregar, una fila por materia ("Geografía · 2 · 1 atrasada").
 * Al tocar una materia se ven sus tareas. Las materias con más atrasos van primero.
 */
export function PendingBySubject({ items }: { items: Pending[] }) {
    const [open, setOpen] = useState<string | null>(null)
    const [showAll, setShowAll] = useState(false)

    if (items.length === 0) {
        return (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <p className="text-sm font-bold text-emerald-900">Todo al día: no hay actividades sin entregar.</p>
            </div>
        )
    }

    const now = Date.now()
    const overdue = (p: Pending) => new Date(p.due_date).getTime() < now
    const groups = groupBySubject(items, p => subjectOf(p.title, p.subject?.name))
        .map(g => ({ ...g, late: g.items.filter(overdue).length }))
        .sort((a, b) => b.late - a.late || b.items.length - a.items.length || a.subject.localeCompare(b.subject))
    const shown = showAll ? groups : groups.slice(0, VISIBLE_GROUPS)

    return (
        <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {shown.map(g => {
                const isOpen = open === g.subject
                return (
                    <div key={g.subject}>
                        <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.subject)}
                            className="w-full min-h-[52px] flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-black text-slate-900 truncate">{g.subject}</span>
                                <span className="block text-xs font-bold text-slate-500">
                                    {g.items.length === 1 ? '1 actividad' : `${g.items.length} actividades`}
                                </span>
                            </span>
                            {g.late > 0 && (
                                <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">
                                    {g.late === 1 ? '1 atrasada' : `${g.late} atrasadas`}
                                </span>
                            )}
                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                            <ul className="px-4 pb-3 space-y-1.5">
                                {g.items.map(p => (
                                    <li key={p.id} className="flex items-baseline gap-2 text-sm">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 translate-y-[-2px] ${overdue(p) ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                        <span className="flex-1 min-w-0 text-slate-800 font-semibold">{shortTitle(p.title, g.subject)}</span>
                                        <span className={`shrink-0 text-xs font-bold ${overdue(p) ? 'text-rose-700' : 'text-slate-500'}`}>
                                            {overdue(p) ? 'venció ' : 'entrega '}{shortDate(p.due_date)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )
            })}
            {groups.length > VISIBLE_GROUPS && (
                <button type="button" onClick={() => setShowAll(v => !v)}
                    className="w-full min-h-[44px] text-sm font-black text-indigo-700 hover:bg-indigo-50">
                    {showAll ? 'Ver menos' : `Ver las ${groups.length} materias`}
                </button>
            )}
        </div>
    )
}
