import type { FilledFormat, FormatSpec } from '../../lib/formats'

/**
 * Dibuja un formato (vacío o llenado) listo para imprimir o guardar como PDF.
 * Usa solo estilos en línea y clases simples para que se vea igual en pantalla y en papel.
 */
export const FormatDocument = ({ spec, filled, id }: { spec: FormatSpec, filled?: FilledFormat | null, id?: string }) => {
    const sectionData = (title: string) => filled?.sections.find(s => s.title.trim().toLowerCase() === title.trim().toLowerCase())
    const cell = 'border border-slate-400 px-2 py-1.5 align-top text-[12px]'
    return (
        <div id={id} className="format-doc bg-white text-slate-900 mx-auto" style={{ maxWidth: spec.orientation === 'landscape' ? '277mm' : '190mm', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <h2 className="text-center text-[15px] font-bold uppercase mb-3">{spec.title}</h2>
            {spec.header_fields.length > 0 && (
                <table className="w-full border-collapse mb-3">
                    <tbody>
                        {chunk(spec.header_fields, 2).map((pair, i) => (
                            <tr key={i}>
                                {pair.map(h => (
                                    <td key={h.label} className={cell} style={{ width: '50%' }}>
                                        <b>{h.label}:</b> {filled?.header?.[h.label] ?? ''}
                                    </td>
                                ))}
                                {pair.length === 1 && <td className={cell} />}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {spec.sections.map(sec => {
                const d = sectionData(sec.title)
                return (
                    <div key={sec.title} className="mb-3 break-inside-avoid">
                        <div className="bg-slate-200 border border-slate-400 px-2 py-1 text-[12px] font-bold uppercase">{sec.title}</div>
                        {sec.type === 'table' ? (
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>{(sec.columns ?? []).map(c => <th key={c} className={`${cell} bg-slate-100 font-bold text-left`}>{c}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {(d?.rows?.length ? d.rows : [Array((sec.columns ?? []).length).fill('')]).map((r, i) => (
                                        <tr key={i}>{(sec.columns ?? []).map((_, j) => <td key={j} className={cell} style={{ height: filled ? undefined : 28 }}>{r[j] ?? ''}</td>)}</tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : sec.type === 'list' ? (
                            <div className={`${cell} border-t-0`} style={{ minHeight: filled ? undefined : 48 }}>
                                {d?.items?.length ? <ul className="list-disc pl-5 space-y-0.5">{d.items.map((it, i) => <li key={i}>{it}</li>)}</ul> : d?.text ?? (filled ? '' : <span className="text-slate-400">{sec.guidance}</span>)}
                            </div>
                        ) : (
                            <div className={`${cell} border-t-0 whitespace-pre-wrap`} style={{ minHeight: filled ? undefined : 48 }}>
                                {d?.text ?? d?.items?.join('\n') ?? (filled ? '' : <span className="text-slate-400">{sec.guidance}</span>)}
                            </div>
                        )}
                    </div>
                )
            })}
            {!!spec.signatures?.length && (
                <div className="grid gap-8 mt-10" style={{ gridTemplateColumns: `repeat(${Math.min(spec.signatures.length, 3)}, 1fr)` }}>
                    {spec.signatures.map(s => (
                        <div key={s} className="text-center text-[12px]"><div className="border-t border-slate-600 pt-1 mx-4">{s}</div></div>
                    ))}
                </div>
            )}
        </div>
    )
}

function chunk<T>(arr: T[], n: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
}

/** Abre una ventana con el formato para imprimir / guardar como PDF (funciona en web y app). */
export function printFormat(elementId: string, title: string) {
    const el = document.getElementById(elementId)
    if (!el) return
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('')
    const w = window.open('', '_blank')
    if (!w) { window.print(); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '')}</title>${styles}<style>body{background:#fff;padding:12mm}@page{margin:10mm}</style></head><body>${el.outerHTML}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
}
