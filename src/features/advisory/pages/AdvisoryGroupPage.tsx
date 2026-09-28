import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, AlertTriangle, Handshake, CalendarX, Star, Plus, Search, Loader2, Info } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { CreateIncidentModal } from '../../evaluation/components/CreateIncidentModal'
import { attentionScore, groupLabel, useAdvisoryGroup, type AdvisoryStudent } from '../lib/useAdvisoryGroup'

const PERIODS = [7, 30, 90] as const
const SEV: Record<string, string> = { ALTA: 'bg-rose-100 text-rose-700', MEDIA: 'bg-amber-100 text-amber-800', BAJA: 'bg-slate-100 text-slate-600' }
const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

/**
 * Asesoría de grupo: el docente asesor ve la conducta, asistencia y compromisos de su grupo
 * aunque no le imparta clase. Lo registrado por cualquier docente del grupo aparece aquí.
 */
export const AdvisoryGroupPage = () => {
    const [days, setDays] = useState<number>(30)
    const { data, isLoading, error } = useAdvisoryGroup(days)
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const qc = useQueryClient()
    const [q, setQ] = useState('')
    const [onlyAttention, setOnlyAttention] = useState(false)
    const [incidentFor, setIncidentFor] = useState<string | null | undefined>(undefined)

    const students = useMemo(() => {
        const list = [...(data?.students ?? [])].sort((a, b) => attentionScore(b) - attentionScore(a))
        const needle = q.trim().toLowerCase()
        return list.filter(s => (!needle || s.name.toLowerCase().includes(needle)) && (!onlyAttention || attentionScore(s) >= 3))
    }, [data, q, onlyAttention])

    if (isLoading) return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando tu grupo…</div>
    if (error) return <div className="p-8 text-rose-600 font-bold">No se pudo cargar la asesoría. Revisa tu conexión.</div>

    if (!data?.group) {
        return (
            <div className="max-w-2xl mx-auto p-6 sm:p-10">
                <div className="bg-white rounded-[2rem] border border-slate-100 p-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4"><ShieldCheck className="w-7 h-7" /></div>
                    <h1 className="text-2xl font-black text-slate-900">Aún no tienes grupo de asesoría</h1>
                    <p className="text-slate-500 mt-2">La dirección asigna el grupo asesorado en <b>Personal y accesos</b>. Cuando te lo asignen, aquí verás la conducta, asistencia y compromisos de tus alumnos, aunque no les des clase.</p>
                </div>
            </div>
        )
    }

    const total = (k: keyof AdvisoryStudent) => data.students.reduce((a, s) => a + (Number(s[k]) || 0), 0)
    const modalStudents = data.students.map(s => ({ id: s.id, first_name: s.name, last_name_paternal: '', last_name_maternal: '' }))

    return (
        <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-20 space-y-6">
            <header className="bg-slate-900 text-white rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-300">Asesoría de grupo</p>
                    <h1 className="text-3xl sm:text-4xl font-black mt-1">Grupo {groupLabel(data.group)}</h1>
                    <p className="text-slate-300 text-sm mt-1">{data.students.length} alumnos · incluye lo que registran todos los docentes del grupo</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div role="group" aria-label="Periodo" className="flex bg-white/10 rounded-xl p-1">
                        {PERIODS.map(p => (
                            <button key={p} onClick={() => setDays(p)} aria-pressed={days === p} className={`px-3 py-2 rounded-lg text-xs font-black ${days === p ? 'bg-white text-slate-900' : 'text-white/80'}`}>{p} días</button>
                        ))}
                    </div>
                    <button onClick={() => setIncidentFor(null)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-sm font-black"><Plus className="w-4 h-4" /> Registrar incidencia</button>
                </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { l: 'Incidencias', v: total('incidents'), i: AlertTriangle, c: 'text-slate-900' },
                    { l: 'Graves', v: total('severe'), i: AlertTriangle, c: 'text-rose-600' },
                    { l: 'Compromisos abiertos', v: total('open_commitments'), i: Handshake, c: 'text-amber-700' },
                    { l: 'Faltas', v: total('absences'), i: CalendarX, c: 'text-slate-900' },
                    { l: 'Reconocimientos', v: total('positive'), i: Star, c: 'text-emerald-600' },
                ].map(t => (
                    <div key={t.l} className="bg-white rounded-2xl border border-slate-100 p-4">
                        <t.i className={`w-5 h-5 ${t.c}`} />
                        <p className={`text-2xl font-black mt-2 ${t.c}`}>{t.v}</p>
                        <p className="text-xs font-bold text-slate-500">{t.l} · {days} días</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <section className="lg:col-span-3 bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-50 flex flex-wrap items-center gap-3 justify-between">
                        <h2 className="text-lg font-black text-slate-900">Alumnos</h2>
                        <div className="flex items-center gap-2 flex-wrap">
                            <label className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar alumno" aria-label="Buscar alumno" className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm w-44" />
                            </label>
                            <button onClick={() => setOnlyAttention(v => !v)} aria-pressed={onlyAttention} className={`px-3 py-2 rounded-xl text-xs font-black border ${onlyAttention ? 'bg-rose-50 border-rose-200 text-rose-700' : 'border-slate-200 text-slate-600'}`}>Requieren atención</button>
                        </div>
                    </div>
                    <ul className="divide-y divide-slate-50">
                        {students.map(s => {
                            const score = attentionScore(s)
                            return (
                                <li key={s.id} className="p-4 flex items-center gap-3">
                                    <span className={`w-2.5 h-10 rounded-full shrink-0 ${score >= 6 ? 'bg-rose-500' : score >= 3 ? 'bg-amber-400' : 'bg-emerald-400'}`} aria-hidden />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-slate-900 text-sm truncate">{s.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                                            <span>{s.incidents} incid.{s.severe > 0 && <b className="text-rose-600"> ({s.severe} graves)</b>}</span>
                                            <span>{s.absences} faltas · {s.lates} retardos</span>
                                            {s.open_commitments > 0 && <span className="text-amber-700 font-bold">{s.open_commitments} compromiso(s) abierto(s)</span>}
                                            {s.positive > 0 && <span className="text-emerald-600 font-bold">{s.positive} reconocimiento(s)</span>}
                                        </p>
                                    </div>
                                    <button onClick={() => setIncidentFor(s.id)} className="text-xs font-black text-indigo-600 px-3 py-2 rounded-xl hover:bg-indigo-50 shrink-0">Registrar</button>
                                </li>
                            )
                        })}
                        {students.length === 0 && <li className="p-8 text-center text-sm text-slate-500">Sin alumnos que coincidan.</li>}
                    </ul>
                </section>

                <section className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-50">
                        <h2 className="text-lg font-black text-slate-900">Lo más reciente</h2>
                        <p className="text-xs text-slate-500">Incidencias y compromisos registrados por los docentes del grupo</p>
                    </div>
                    <ul className="p-4 space-y-3 max-h-[640px] overflow-y-auto">
                        {data.recent.map(r => (
                            <li key={r.id} className="rounded-2xl border border-slate-100 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-black text-slate-900 truncate">{r.student}</p>
                                    <span className="text-[11px] font-bold text-slate-400 shrink-0">{fmt(r.created_at)}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-700 mt-1">{r.title || r.type}</p>
                                {r.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.description}</p>}
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${r.type === 'POSITIVO' ? 'bg-emerald-100 text-emerald-700' : SEV[r.severity] ?? SEV.BAJA}`}>{r.type === 'POSITIVO' ? 'Reconocimiento' : `Gravedad ${r.severity?.toLowerCase()}`}</span>
                                    {r.has_commitment && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">Compromiso</span>}
                                    {r.teacher && <span className="text-[11px] text-slate-400">por {r.teacher}</span>}
                                </div>
                            </li>
                        ))}
                        {data.recent.length === 0 && (
                            <li className="text-center text-sm text-slate-500 py-8">Sin incidencias en los últimos {days} días.</li>
                        )}
                    </ul>
                </section>
            </div>

            <p className="text-xs text-slate-500 flex items-start gap-2"><Info className="w-4 h-4 shrink-0" /> Para citar a un tutor o ver el expediente completo usa <Link to="/gradebook?tab=REPORTS" className="font-bold text-indigo-600">Conducta y reportes</Link>.</p>

            {incidentFor !== undefined && tenant?.id && profile?.id && (
                <CreateIncidentModal
                    isOpen
                    onClose={() => setIncidentFor(undefined)}
                    onSuccess={() => { setIncidentFor(undefined); qc.invalidateQueries({ queryKey: ['advisory-group'] }) }}
                    groupId={data.group.id}
                    students={modalStudents}
                    defaultStudentId={incidentFor}
                    tenantId={tenant.id}
                    teacherId={profile.id}
                />
            )}
        </div>
    )
}
