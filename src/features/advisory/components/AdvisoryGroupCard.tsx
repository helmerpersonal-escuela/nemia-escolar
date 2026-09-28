import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import { attentionScore, groupLabel, useAdvisoryGroup } from '../lib/useAdvisoryGroup'

/** Tarjeta de la consola: resumen del grupo que asesora el docente (solo si tiene uno). */
export const AdvisoryGroupCard = () => {
    const { data } = useAdvisoryGroup(30)
    if (!data?.group) return null
    const sum = (k: 'incidents' | 'severe' | 'open_commitments' | 'absences') => data.students.reduce((a, s) => a + (s[k] || 0), 0)
    const attention = data.students.filter(s => attentionScore(s) >= 3).length
    return (
        <Link to="/asesoria" className="block bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 sm:p-6 hover:border-indigo-200 transition-colors">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shrink-0"><ShieldCheck className="w-5 h-5" /></div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Grupo que asesoras</p>
                        <p className="text-lg font-black text-slate-900 truncate">{groupLabel(data.group)} · {data.students.length} alumnos</p>
                    </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-center">
                {[
                    ['Incidencias (30 días)', sum('incidents'), 'text-slate-900'],
                    ['Graves', sum('severe'), 'text-rose-600'],
                    ['Compromisos abiertos', sum('open_commitments'), 'text-amber-700'],
                    ['Requieren atención', attention, 'text-indigo-700'],
                ].map(([l, v, c]) => (
                    <div key={l as string} className="rounded-xl bg-slate-50 px-2 py-2">
                        <p className={`text-xl font-black ${c}`}>{v as number}</p>
                        <p className="text-[11px] font-bold text-slate-500 leading-tight">{l as string}</p>
                    </div>
                ))}
            </div>
        </Link>
    )
}
