import { useMemo, useState } from 'react'
import { ChevronRight, ClipboardCheck, LayoutGrid } from 'lucide-react'
import { DOC_TYPES, docHeadline, docLabel, docShort, type DocStatus } from '../lib/types'
import type { CoopBundleCtx } from './shared'
import { Card, Empty, StatusBadge } from './ui'

const DOT: Record<DocStatus | 'NONE', string> = {
    NONE: 'bg-slate-100 text-slate-400',
    BORRADOR: 'bg-slate-200 text-slate-600',
    ENVIADO: 'bg-indigo-600 text-white',
    CON_OBSERVACIONES: 'bg-amber-400 text-white',
    APROBADO: 'bg-emerald-600 text-white',
}
const SHORT: Record<DocStatus | 'NONE', string> = { NONE: '—', BORRADOR: 'B', ENVIADO: 'E', CON_OBSERVACIONES: 'O', APROBADO: '✓' }

export const ReviewTab = ({ bundle, onOpen }: { bundle: CoopBundleCtx; onOpen: (id: string) => void }) => {
    const { documents, units } = bundle
    const [status, setStatus] = useState<DocStatus | 'TODOS'>('ENVIADO')
    const list = documents.filter(d => d.status !== 'BORRADOR' && (status === 'TODOS' || d.status === status))
        .sort((a, b) => (b.submitted_at ?? b.updated_at).localeCompare(a.submitted_at ?? a.updated_at))
    const counts = useMemo(() => ({
        ENVIADO: documents.filter(d => d.status === 'ENVIADO').length,
        CON_OBSERVACIONES: documents.filter(d => d.status === 'CON_OBSERVACIONES').length,
        APROBADO: documents.filter(d => d.status === 'APROBADO').length,
    }), [documents])

    // Tablero: docentes (unidades de producción + quien haya llenado formatos) × formatos
    const teachers = useMemo(() => {
        const map = new Map<string, { id: string; name: string; unit: string }>()
        for (const u of units) if (u.teacher_id) map.set(u.teacher_id, { id: u.teacher_id, name: '', unit: u.name })
        for (const d of documents) if (d.teacher_id) {
            const t = map.get(d.teacher_id) ?? { id: d.teacher_id, name: '', unit: '' }
            if (!t.name && d.teacher?.full_name) t.name = d.teacher.full_name
            map.set(d.teacher_id, t)
        }
        return [...map.values()].sort((a, b) => (a.name || a.unit).localeCompare(b.name || b.unit))
    }, [units, documents])
    const cell = (teacherId: string, type: string): DocStatus | 'NONE' => {
        const docs = documents.filter(d => d.teacher_id === teacherId && d.doc_type === type)
        if (!docs.length) return 'NONE'
        const order: DocStatus[] = ['CON_OBSERVACIONES', 'ENVIADO', 'BORRADOR', 'APROBADO']
        return order.find(s => docs.some(d => d.status === s)) ?? 'NONE'
    }

    return (
        <div className="space-y-4">
            <Card title="Bandeja de revisión" icon={ClipboardCheck}>
                <div className="flex gap-1 overflow-x-auto mb-3">
                    {([['ENVIADO', `Por revisar (${counts.ENVIADO})`], ['CON_OBSERVACIONES', `Con observaciones (${counts.CON_OBSERVACIONES})`], ['APROBADO', `Aprobados (${counts.APROBADO})`], ['TODOS', 'Todos']] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setStatus(k)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-black ${status === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
                    ))}
                </div>
                {list.length === 0 ? (
                    <Empty icon={ClipboardCheck} title={status === 'ENVIADO' ? 'No hay formatos por revisar' : 'Sin formatos en esta vista'} text="Cuando un docente envíe un formato a revisión aparecerá aquí." />
                ) : (
                    <ul className="space-y-2">
                        {list.map(d => (
                            <li key={d.id}>
                                <button onClick={() => onOpen(d.id)} className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 px-3 py-2.5 text-left">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-800 truncate">{docLabel(d.doc_type)}</p>
                                        <p className="text-xs text-slate-500 truncate">{d.teacher?.full_name || 'Docente'} · {docHeadline(d)}</p>
                                        {d.submitted_at && <p className="text-[11px] text-slate-400">Enviado {new Date(d.submitted_at).toLocaleDateString('es-MX')}</p>}
                                    </div>
                                    <StatusBadge status={d.status} />
                                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Tablero de entregas por docente" icon={LayoutGrid}>
                {teachers.length === 0 ? (
                    <p className="text-sm text-slate-500">Aún no hay docentes con unidad de producción o formatos.</p>
                ) : (
                    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                        <table className="w-full text-xs min-w-[560px]">
                            <thead>
                                <tr className="text-left text-slate-500">
                                    <th className="py-2 pr-2 font-black">Docente / unidad</th>
                                    {DOC_TYPES.map(d => <th key={d.type} className="py-2 px-1 font-black text-center">{docShort(d.type)}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {teachers.map(t => (
                                    <tr key={t.id}>
                                        <td className="py-2 pr-2">
                                            <div className="font-bold text-slate-800">{t.name || 'Docente'}</div>
                                            {t.unit && <div className="text-slate-400">{t.unit}</div>}
                                        </td>
                                        {DOC_TYPES.map(d => {
                                            const s = cell(t.id, d.type)
                                            return <td key={d.type} className="py-2 px-1 text-center"><span className={`inline-flex w-7 h-7 rounded-full items-center justify-center font-black ${DOT[s]}`}>{SHORT[s]}</span></td>
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="text-[11px] text-slate-400 mt-3">B = borrador · E = enviado · O = con observaciones · ✓ = aprobado · — = sin iniciar</p>
            </Card>
        </div>
    )
}
