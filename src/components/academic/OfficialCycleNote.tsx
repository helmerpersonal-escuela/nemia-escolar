import { BadgeCheck, CloudOff, Loader2, RotateCcw } from 'lucide-react'
import type { OfficialCycle } from '../../lib/officialCalendar'
import { formatDateEs } from '../ui/DateInput'

export type CycleSource = 'oficial' | 'manual' | 'estimado'

interface Props {
    source: CycleSource
    official: OfficialCycle | null | undefined
    loading?: boolean
    onUseOfficial: () => void
}

/** Explica de dónde salieron las fechas del ciclo y permite volver a las oficiales. */
export const OfficialCycleNote = ({ source, official, loading, onUseOfficial }: Props) => {
    if (loading && source === 'estimado') {
        return (
            <p className="flex items-center gap-2 text-xs font-bold text-slate-500 px-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Consultando el calendario escolar oficial de la SEP…
            </p>
        )
    }
    if (source === 'oficial' && official) {
        return (
            <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                <BadgeCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                    <b>Calendario oficial SEP {official.schoolYear}</b>: del {formatDateEs(official.startDate)} al {formatDateEs(official.endDate)}
                    {official.schoolDays ? ` (${official.schoolDays} días de clase)` : ''}. Puedes cambiar estas fechas si tu escuela tiene otras.
                    {official.sourceUrl && <> <a href={official.sourceUrl} target="_blank" rel="noreferrer" className="underline font-bold">Ver fuente</a></>}
                </p>
            </div>
        )
    }
    if (source === 'manual') {
        return (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <span>Fechas modificadas por ti.</span>
                {official && (
                    <button type="button" onClick={onUseOfficial} className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline">
                        <RotateCcw className="w-3.5 h-3.5" /> Usar calendario oficial {official.schoolYear}
                    </button>
                )}
            </div>
        )
    }
    return (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            <CloudOff className="w-4 h-4 shrink-0 mt-0.5" />
            <p>No se pudo consultar el calendario oficial (sin conexión). Usamos fechas estimadas: revísalas antes de continuar.</p>
        </div>
    )
}
