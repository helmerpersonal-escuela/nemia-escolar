import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ClipboardList, Lightbulb, RefreshCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/dates'
import { formatDateEs } from '../ui/DateInput'

/**
 * Mejora continua: recuerda que el programa analítico, la planeación y los PDAs
 * se pueden perfeccionar en cualquier momento, y en especial en cada sesión de CTE.
 */
export const ContinuousImprovementCard = ({ compact = false }: { compact?: boolean }) => {
    const navigate = useNavigate()
    const { data: nextCte } = useQuery({
        queryKey: ['next-cte', todayISO()],
        staleTime: 1000 * 60 * 60 * 6,
        queryFn: async () => {
            const { data } = await supabase.from('cte_calendar').select('date, session_number, session_type').gte('date', todayISO()).order('date').limit(1)
            // null (no undefined): React Query marca error si la consulta regresa undefined
            return (data?.[0] ?? null) as { date: string; session_number: number; session_type: string } | null
        },
    })
    const days = nextCte ? Math.round((new Date(nextCte.date + 'T12:00:00').getTime() - new Date(todayISO() + 'T12:00:00').getTime()) / 86400000) : null
    const soon = days !== null && days <= 7

    const links = [
        { label: 'Programa analítico', icon: BookOpen, path: '/analytical-program' },
        { label: 'Mis planeaciones', icon: ClipboardList, path: '/planning' },
        { label: 'Mis PDAs', icon: Lightbulb, path: '/mis-pdas' },
    ]

    return (
        <div className={`rounded-[1.75rem] border p-5 sm:p-6 ${soon ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}>
            <div className="flex items-start gap-3 mb-4">
                <div className={`p-3 rounded-2xl shrink-0 ${soon ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-600'}`}><RefreshCcw className="w-5 h-5" /></div>
                <div className="min-w-0">
                    <p className="font-black text-slate-900">Mejora continua</p>
                    <p className="text-sm text-slate-600">
                        {nextCte
                            ? days === 0
                                ? `Hoy hay sesión de CTE (${nextCte.session_number}ª). Buen momento para ajustar tu programa analítico, tu planeación o crear PDAs.`
                                : `Próxima sesión de CTE: ${formatDateEs(nextCte.date)}${days !== null && days <= 7 ? ` (en ${days} día${days === 1 ? '' : 's'})` : ''}. Puedes mejorar tu trabajo en cualquier momento del ciclo.`
                            : 'Puedes mejorar tu programa analítico, tu planeación y tus PDAs en cualquier momento del ciclo.'}
                    </p>
                </div>
            </div>
            <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 min-[420px]:grid-cols-3'}`}>
                {links.map(l => (
                    <button key={l.path} onClick={() => navigate(l.path)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-700 hover:border-indigo-200 hover:text-indigo-700 text-left">
                        <l.icon className="w-4 h-4 shrink-0" /> {l.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
