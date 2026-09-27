import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { todayISO } from '../../../lib/dates'
import { formatDateEs } from '../../../components/ui/DateInput'

const ALLOWED = ['DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER', 'SCHOOL_CONTROL']
const DAYS_BEFORE = 21

/** Aviso para iniciar el siguiente ciclo cuando el actual está por terminar o ya terminó. */
export const NewCycleBanner = () => {
    const { data: tenant } = useTenant()
    const navigate = useNavigate()
    const location = useLocation()
    const [dismissed, setDismissed] = useState(() => {
        try { return sessionStorage.getItem('vunlek_new_cycle_dismissed') === '1' } catch { return false }
    })
    const role = (tenant as any)?.role as string | undefined
    const allowed = !!tenant?.id && !!role && ALLOWED.includes(role)

    const { data: year } = useQuery({
        queryKey: ['active-year', tenant?.id],
        enabled: allowed,
        staleTime: 1000 * 60 * 30,
        queryFn: async () => {
            const { data } = await supabase.from('academic_years').select('id, name, end_date').eq('tenant_id', tenant!.id).eq('is_active', true).maybeSingle()
            return data as { id: string; name: string; end_date: string } | null
        },
    })

    if (!allowed || !year?.end_date || dismissed || location.pathname.startsWith('/nuevo-ciclo')) return null
    const today = todayISO()
    const days = Math.round((new Date(year.end_date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
    if (days > DAYS_BEFORE) return null
    const ended = days < 0

    return (
        <div className={`mb-4 rounded-2xl border p-4 flex flex-wrap items-center gap-3 ${ended ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
            <CalendarRange className="w-6 h-6 shrink-0" />
            <div className="flex-1 min-w-[12rem]">
                <p className="font-black text-sm">{ended ? `El ${year.name} terminó` : `El ${year.name} termina el ${formatDateEs(year.end_date)}`}</p>
                <p className={`text-xs ${ended ? 'text-indigo-100' : 'text-indigo-700'}`}>Inicia el siguiente ciclo: tus grupos suben de grado, egresa la generación y conservas tu programa analítico y planeaciones.</p>
            </div>
            <button onClick={() => navigate('/nuevo-ciclo')} className={`px-4 py-2 rounded-xl font-black text-sm ${ended ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'}`}>Iniciar nuevo ciclo</button>
            <button aria-label="Ocultar aviso" onClick={() => { setDismissed(true); try { sessionStorage.setItem('vunlek_new_cycle_dismissed', '1') } catch { /* nada */ } }} className="p-2 -m-1 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
    )
}
