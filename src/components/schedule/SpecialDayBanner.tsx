import { CalendarClock } from 'lucide-react'
import { describeSpecialDay, type SpecialDay } from '../../lib/specialDays'

/** Aviso de "hoy hay horario especial" para inicio y agenda. */
export function SpecialDayBanner({ special, suspended = 0, label = 'Hoy' }: { special: SpecialDay | null | undefined; suspended?: number; label?: string }) {
    if (!special) return null
    const tone = special.mode === 'NO_CLASSES' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'
    return (
        <div role="status" className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${tone}`}>
            <CalendarClock className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
                <p className="font-bold">{label}: horario especial — {describeSpecialDay(special)}</p>
                {suspended > 0 && special.mode !== 'NO_CLASSES' && <p>{suspended === 1 ? '1 de tus clases se suspende' : `${suspended} de tus clases se suspenden`}; las demás ya muestran su nuevo horario.</p>}
                {special.note && <p className="mt-0.5">{special.note}</p>}
            </div>
        </div>
    )
}
