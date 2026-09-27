import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, ClipboardCheck, MessageSquareWarning, Store } from 'lucide-react'
import { useCooperativeData, useCoopRole } from '../lib/useCooperative'
import { deadlineStates, levelText } from '../lib/deadlines'
import { docShort } from '../lib/types'

/** Avisos de la cooperativa en el tablero: fechas de la circular, observaciones y formatos por revisar. */
export const CoopDashboardAlerts = () => {
    const { isReviewer, isTeacher } = useCoopRole()
    const { coop, data } = useCooperativeData()
    if (!coop || !data?.ctx) return null
    const me = data.ctx.teacher.id
    const alerts = isTeacher ? deadlineStates(data.deadlines, data.documents, me).filter(s => s.level === 'overdue' || s.level === 'soon') : []
    const observed = data.documents.filter(d => d.teacher_id === me && d.status === 'CON_OBSERVACIONES')
    const pending = isReviewer ? data.documents.filter(d => d.status === 'ENVIADO').length : 0
    const coordinator = isReviewer && !isTeacher
    if (!alerts.length && !observed.length && !pending && !coordinator) return null

    return (
        <div className={`mb-4 bg-white rounded-3xl border ${alerts.length || observed.length || pending ? 'border-amber-100' : 'border-slate-100'} shadow-sm p-4`}>
            <div className="flex items-center gap-2 mb-2">
                <Store className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-black text-slate-900 truncate">Cooperativa · {coop.name}</p>
            </div>
            <ul className="space-y-1.5">
                {alerts.map(s => (
                    <li key={s.deadline.id}>
                        <Link to="/cooperativa?tab=formatos" className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${s.level === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span className="flex-1 min-w-0 truncate"><b>{docShort(s.deadline.doc_type)}</b> · {levelText(s)}</span>
                            <ChevronRight className="w-4 h-4 shrink-0" />
                        </Link>
                    </li>
                ))}
                {observed.map(d => (
                    <li key={d.id}>
                        <Link to={`/cooperativa?doc=${d.id}`} className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 bg-amber-50 text-amber-800">
                            <MessageSquareWarning className="w-4 h-4 shrink-0" />
                            <span className="flex-1 min-w-0 truncate"><b>{docShort(d.doc_type)}</b> regresó con observaciones</span>
                            <ChevronRight className="w-4 h-4 shrink-0" />
                        </Link>
                    </li>
                ))}
                {coordinator && pending === 0 && (
                    <li>
                        <Link to="/cooperativa" className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 bg-slate-50 text-slate-700">
                            <ClipboardCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                            <span className="flex-1">Sin formatos pendientes de revisión · Abrir módulo</span>
                            <ChevronRight className="w-4 h-4 shrink-0" />
                        </Link>
                    </li>
                )}
                {pending > 0 && (
                    <li>
                        <Link to="/cooperativa?tab=revision" className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 bg-indigo-50 text-indigo-700">
                            <ClipboardCheck className="w-4 h-4 shrink-0" />
                            <span className="flex-1">{pending} formato(s) por revisar</span>
                            <ChevronRight className="w-4 h-4 shrink-0" />
                        </Link>
                    </li>
                )}
            </ul>
        </div>
    )
}
