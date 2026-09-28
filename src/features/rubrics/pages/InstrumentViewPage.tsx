import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { FormatDocument, printFormat } from '../../../components/formats/FormatDocument'

/** Visor imprimible de un instrumento generado (con el formato del docente si lo eligió). */
export const InstrumentViewPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { data, isLoading } = useQuery({
        queryKey: ['rubric', id],
        enabled: !!id,
        queryFn: async () => (await supabase.from('rubrics').select('*').eq('id', id!).maybeSingle()).data as any,
    })
    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
    if (!data) return <div className="p-8 text-slate-500">No se encontró el instrumento.</div>
    const c = data.content ?? {}
    const meta = c.meta ?? {}
    const cell = 'border border-slate-400 px-2 py-1.5 align-top text-[12px]'

    return (
        <div className="max-w-5xl mx-auto px-3 sm:px-0 pb-20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => navigate('/rubrics')} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100"><ArrowLeft className="w-4 h-4" /> Instrumentos</button>
                <button onClick={() => printFormat('instrument-doc', data.title)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black"><Printer className="w-4 h-4" /> Imprimir / PDF</button>
            </div>
            <div className="bg-white p-6 sm:p-8 shadow-sm border border-slate-100 overflow-x-auto">
                {c.format?.spec ? (
                    <FormatDocument id="instrument-doc" spec={c.format.spec} filled={c.format.filled} />
                ) : (
                    <div id="instrument-doc" className="format-doc text-slate-900" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        <h2 className="text-center text-[15px] font-bold uppercase mb-2">{data.title}</h2>
                        <table className="w-full border-collapse mb-3"><tbody>
                            <tr><td className={cell}><b>Campo formativo:</b> {meta.campo ?? ''}</td><td className={cell}><b>Grado:</b> {meta.grade ? `${meta.grade}°` : ''}</td></tr>
                            <tr><td className={cell}><b>Alumno(a):</b></td><td className={cell}><b>Fecha:</b></td></tr>
                            {!!meta.pdas?.length && <tr><td className={cell} colSpan={2}><b>PDA:</b> {meta.pdas.join(' · ')}</td></tr>}
                            {!!meta.ejes?.length && <tr><td className={cell} colSpan={2}><b>Ejes articuladores:</b> {meta.ejes.join(', ')}{meta.metodologia ? ` · Metodología: ${meta.metodologia}` : ''}</td></tr>}
                        </tbody></table>

                        {Array.isArray(c.criteria) && (
                            <table className="w-full border-collapse">
                                <thead><tr>
                                    <th className={`${cell} bg-slate-100 text-left`}>Criterio</th>
                                    {(c.criteria[0]?.levels ?? []).map((l: any, i: number) => <th key={i} className={`${cell} bg-slate-100 text-left`}>{l.title} ({l.score})</th>)}
                                </tr></thead>
                                <tbody>{c.criteria.map((cr: any, i: number) => (
                                    <tr key={i}><td className={`${cell} font-bold`}>{cr.title}{cr.weight ? ` (${cr.weight}%)` : ''}</td>{(cr.levels ?? []).map((l: any, j: number) => <td key={j} className={cell}>{l.descriptor ?? ''}</td>)}</tr>
                                ))}</tbody>
                            </table>
                        )}

                        {Array.isArray(c.items) && (
                            <table className="w-full border-collapse">
                                <thead><tr>
                                    <th className={`${cell} bg-slate-100 text-left`}>Indicador</th>
                                    {(c.scale ?? ['Sí', 'No']).map((s: string) => <th key={s} className={`${cell} bg-slate-100 w-20`}>{s}</th>)}
                                    <th className={`${cell} bg-slate-100 text-left w-1/4`}>Observaciones</th>
                                </tr></thead>
                                <tbody>{c.items.map((it: any, i: number) => (
                                    <tr key={i}><td className={cell}>{i + 1}. {it.text ?? String(it)}</td>{(c.scale ?? ['Sí', 'No']).map((s: string) => <td key={s} className={cell} />)}<td className={cell} /></tr>
                                ))}</tbody>
                            </table>
                        )}

                        {Array.isArray(c.questions) && (
                            <ol className="space-y-4 list-decimal pl-5 text-[13px]">
                                {c.questions.map((q: any, i: number) => (
                                    <li key={i}>
                                        <p>{q.text}</p>
                                        {Array.isArray(q.options) ? (
                                            <ol className="list-[lower-alpha] pl-6 mt-1">{q.options.map((o: string, j: number) => <li key={j}>{o}</li>)}</ol>
                                        ) : <div className="border-b border-slate-300 h-10" />}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
