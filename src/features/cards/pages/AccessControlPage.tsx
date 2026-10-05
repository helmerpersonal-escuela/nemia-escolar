import { useCallback, useEffect, useState } from 'react'
import { DoorOpen } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { CardListener, type ScanResult } from '../components/CardListener'

const nowHM = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * Control de acceso: el alumno acerca su credencial (NFC), muestra su QR o la pasa por el lector
 * y queda su asistencia del día; después de la hora límite se registra como retardo.
 */
export const AccessControlPage = () => {
    const [limit, setLimit] = useState(() => { try { return localStorage.getItem('vunlek_acceso_limite') || '07:10' } catch { return '07:10' } })
    const [useLimit, setUseLimit] = useState(true)
    const [counts, setCounts] = useState({ present: 0, late: 0 })
    useEffect(() => { try { localStorage.setItem('vunlek_acceso_limite', limit) } catch { /* nada */ } }, [limit])

    const onCode = useCallback(async (code: string): Promise<ScanResult> => {
        const late = useLimit && nowHM() > limit
        const { data, error } = await supabase.rpc('card_check_in', { p_code: code, p_status: late ? 'LATE' : 'PRESENT' })
        if (error) return { tone: 'bad', title: 'No se pudo registrar', detail: error.message }
        const r = data as any
        if (!r?.found) return { tone: 'bad', title: 'Credencial no reconocida', detail: 'No pertenece a un alumno de esta escuela', notFound: true }
        if (r.error) return { tone: 'warn', title: r.name, detail: r.error }
        if (r.already) return { tone: 'warn', title: r.name, detail: `${r.group} · ya tenía registro de hoy` }
        setCounts(c => (r.status === 'LATE' ? { ...c, late: c.late + 1 } : { ...c, present: c.present + 1 }))
        return { tone: 'ok', title: r.name, detail: `${r.group} · ${r.status === 'LATE' ? 'Retardo' : 'Entrada registrada'}` }
    }, [limit, useLimit])

    return (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 flex items-start gap-3">
                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><DoorOpen className="w-6 h-6" /></div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Control de acceso</h1>
                    <p className="text-slate-600 text-sm">Registra la entrada de cualquier alumno de la escuela con su credencial. Queda como su asistencia del día.</p>
                </div>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-slate-100 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2 font-bold text-slate-700">
                    <input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={useLimit} onChange={e => setUseLimit(e.target.checked)} />
                    Marcar retardo después de las
                </label>
                <input type="time" aria-label="Hora límite de entrada" value={limit} onChange={e => setLimit(e.target.value)} disabled={!useLimit}
                    className="min-h-[44px] rounded-2xl border border-slate-200 px-3 font-bold disabled:opacity-50" />
                <span className="ml-auto text-slate-600">En esta sesión: <b className="text-emerald-700">{counts.present} entradas</b> · <b className="text-amber-700">{counts.late} retardos</b></span>
            </div>
            <CardListener onCode={onCode} title="Entrada de alumnos" />
        </div>
    )
}
