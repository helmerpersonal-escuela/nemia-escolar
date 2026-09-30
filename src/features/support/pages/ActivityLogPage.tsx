import { useEffect, useMemo, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { formatDateEs } from '../../../components/ui/DateInput'

type Row = { actor_id: string | null; table_name: string; action: string; record_label: string | null; created_at: string }

const TABLE: Record<string, string> = {
    groups: 'Grupos', students: 'Alumnos', guardians: 'Tutores', group_subjects: 'Materias de grupos', schedules: 'Horario de clases',
    schedule_settings: 'Jornada escolar', academic_years: 'Ciclo escolar', evaluation_periods: 'Periodos de evaluación', school_details: 'Datos de la escuela',
    staff_invitations: 'Invitaciones al personal', staff_roster: 'Plantilla', profile_tenants: 'Puestos del personal', special_schedule_structure: 'Días especiales',
}
const ACTION: Record<string, string> = { INSERT: 'agregó', UPDATE: 'cambió', DELETE: 'quitó' }

/**
 * Bitácora de cambios del administrador técnico: qué datos de la escuela tocó y cuándo,
 * agrupado por día. La dirección la consulta para saber qué se hizo sin revisar registro por registro.
 */
export const ActivityLogPage = () => {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    const [rows, setRows] = useState<Row[]>([])
    const [names, setNames] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [days, setDays] = useState(30)

    useEffect(() => {
        if (!tenantId) return
        let alive = true
        setLoading(true)
        const since = new Date(); since.setDate(since.getDate() - days)
        Promise.all([
            supabase.from('tech_activity_log').select('actor_id, table_name, action, record_label, created_at').eq('tenant_id', tenantId).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(5000),
            supabase.rpc('school_staff'),
        ]).then(([{ data }, { data: staff }]) => {
            if (!alive) return
            setRows((data as Row[]) ?? [])
            setNames(Object.fromEntries(((staff as any[]) ?? []).map(m => [m.profile_id, [m.first_name, m.last_name_paternal].filter(Boolean).join(' ') || m.email])))
            setLoading(false)
        })
        return () => { alive = false }
    }, [tenantId, days])

    // Día → persona → "cambió 12 Alumnos (ej. 1A, 2B…)"
    const byDay = useMemo(() => {
        const out = new Map<string, Map<string, { key: string; action: string; table: string; n: number; samples: string[] }>>()
        for (const r of rows) {
            const day = r.created_at.slice(0, 10)
            const key = `${r.actor_id}|${r.action}|${r.table_name}`
            if (!out.has(day)) out.set(day, new Map())
            const m = out.get(day)!
            const e = m.get(key) ?? { key, action: r.action, table: r.table_name, n: 0, samples: [] }
            e.n++
            if (r.record_label && e.samples.length < 3 && !e.samples.includes(r.record_label)) e.samples.push(r.record_label)
            m.set(key, e)
        }
        return [...out.entries()]
    }, [rows])

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><History className="w-6 h-6" /></div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Bitácora de cambios</h1>
                        <p className="text-slate-600 text-sm">Lo que el administrador técnico agregó, cambió o quitó en los datos de la escuela.</p>
                    </div>
                </div>
                <select aria-label="Periodo" value={days} onChange={e => setDays(Number(e.target.value))} className="min-h-[44px] px-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold">
                    <option value={7}>Últimos 7 días</option>
                    <option value={30}>Últimos 30 días</option>
                    <option value={90}>Últimos 90 días</option>
                </select>
            </div>
            {loading ? <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p> : !byDay.length ? (
                <p className="text-sm text-slate-500 bg-white rounded-3xl border border-slate-100 p-6">Sin cambios en este periodo.</p>
            ) : byDay.map(([day, entries]) => (
                <section key={day} className="bg-white rounded-3xl p-5 border border-slate-100">
                    <h2 className="font-black text-slate-900 mb-2">{formatDateEs(day)}</h2>
                    <ul className="space-y-1.5 text-sm">
                        {[...entries.values()].map(e => {
                            const actor = e.key.split('|')[0]
                            return (
                                <li key={e.key} className="text-slate-700">
                                    <b className="text-slate-900">{names[actor] ?? 'Administrador técnico'}</b> {ACTION[e.action] ?? e.action.toLowerCase()} {e.n} {e.n === 1 ? 'registro' : 'registros'} de <b>{TABLE[e.table] ?? e.table}</b>
                                    {e.samples.length > 0 && <span className="text-slate-500"> (ej. {e.samples.join(', ')}{e.n > e.samples.length ? '…' : ''})</span>}
                                </li>
                            )
                        })}
                    </ul>
                </section>
            ))}
        </div>
    )
}
