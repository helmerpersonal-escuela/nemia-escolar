import { useEffect, useMemo, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * Selector de fecha en español que reemplaza al input nativo de tipo fecha.
 *
 * El selector nativo toma el idioma del teléfono o del navegador (en Android y en
 * muchos equipos aparece en inglés). Este siempre se muestra en español y con la
 * semana de lunes a domingo. Mismo contrato que el input: `value` en formato
 * AAAA-MM-DD y `onChange(e)` con `e.target.value`.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const parse = (v?: string | number | readonly string[]) => {
    const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null
    return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null
}

export function formatDateEs(value?: string, short = false) {
    const p = parse(value)
    if (!p) return ''
    const mes = MESES[p.m]
    return short ? `${p.d} ${mes.slice(0, 3)} ${p.y}` : `${p.d} de ${mes} de ${p.y}`
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> & {
    value?: string
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void
    /** Oculta el ícono cuando el campo ya trae uno propio. */
    hideIcon?: boolean
}

export const DateInput = ({ value, onChange, min, max, disabled, className = '', placeholder, required, name, id, hideIcon, ...rest }: Props) => {
    const [open, setOpen] = useState(false)
    const selected = parse(value)
    const today = new Date()
    const [view, setView] = useState(() => ({ y: selected?.y ?? today.getFullYear(), m: selected?.m ?? today.getMonth() }))

    useEffect(() => {
        if (open) setView({ y: selected?.y ?? today.getFullYear(), m: selected?.m ?? today.getMonth() })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open])

    const minS = typeof min === 'string' ? min : undefined
    const maxS = typeof max === 'string' ? max : undefined
    const outOfRange = (iso: string) => (!!minS && iso < minS) || (!!maxS && iso > maxS)

    const emit = (next: string) => {
        onChange?.({ target: { value: next, name: name ?? '' }, currentTarget: { value: next, name: name ?? '' } } as unknown as ChangeEvent<HTMLInputElement>)
    }

    const years = useMemo(() => {
        const minY = parse(minS)?.y ?? today.getFullYear() - 90
        const maxY = parse(maxS)?.y ?? today.getFullYear() + 10
        const list: number[] = []
        for (let y = maxY; y >= minY; y--) list.push(y)
        if (!list.includes(view.y)) list.push(view.y)
        return list.sort((a, b) => b - a)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [minS, maxS, view.y])

    const cells = useMemo(() => {
        const first = new Date(view.y, view.m, 1)
        const offset = (first.getDay() + 6) % 7 // lunes = 0
        const days = new Date(view.y, view.m + 1, 0).getDate()
        const out: (number | null)[] = Array(offset).fill(null)
        for (let d = 1; d <= days; d++) out.push(d)
        while (out.length % 7) out.push(null)
        return out
    }, [view])

    const move = (delta: number) => setView(v => {
        const m = v.m + delta
        return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })

    const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate())

    return (
        <>
            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => setOpen(true)}
                aria-label={rest['aria-label'] ? `${rest['aria-label']}: ${formatDateEs(value) || 'sin fecha'}` : undefined}
                className={`${className} inline-flex items-center justify-between gap-2 text-left disabled:opacity-60`}
            >
                <span className={`truncate ${value ? '' : 'text-slate-400'}`}>
                    {value ? formatDateEs(value, true) : (placeholder || 'Elegir fecha')}
                </span>
                {!hideIcon && <CalendarDays className="w-4 h-4 shrink-0 opacity-60" aria-hidden="true" />}
            </button>
            {/* Mantiene la validación "required" y el envío del formulario */}
            <input tabIndex={-1} aria-hidden="true" className="sr-only" name={name} required={required} value={value ?? ''} onChange={() => undefined} />

            {open && createPortal(
                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={() => setOpen(false)}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Elegir fecha"
                        onClick={e => e.stopPropagation()}
                        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 duration-200"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{rest['aria-label'] || 'Fecha'}</p>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="p-2 -m-2 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xl font-black text-slate-900 mb-4 first-letter:uppercase">{value ? formatDateEs(value) : 'Sin fecha'}</p>

                        <div className="flex items-center gap-2 mb-3">
                            <button type="button" onClick={() => move(-1)} aria-label="Mes anterior" className="p-2 rounded-xl hover:bg-slate-100 text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
                            <select aria-label="Mes" value={view.m} onChange={e => setView(v => ({ ...v, m: Number(e.target.value) }))}
                                className="flex-1 min-w-0 capitalize bg-slate-50 rounded-xl px-2 py-2 text-sm font-bold text-slate-800 border border-slate-100">
                                {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                            </select>
                            <select aria-label="Año" value={view.y} onChange={e => setView(v => ({ ...v, y: Number(e.target.value) }))}
                                className="w-24 bg-slate-50 rounded-xl px-2 py-2 text-sm font-bold text-slate-800 border border-slate-100">
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <button type="button" onClick={() => move(1)} aria-label="Mes siguiente" className="p-2 rounded-xl hover:bg-slate-100 text-slate-600"><ChevronRight className="w-5 h-5" /></button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center">
                            {DIAS.map((d, i) => <div key={i} className="text-[11px] font-black text-slate-400 py-1">{d}</div>)}
                            {cells.map((d, i) => {
                                if (!d) return <div key={i} />
                                const iso = toISO(view.y, view.m, d)
                                const isSel = iso === value
                                const isToday = iso === todayISO
                                const off = outOfRange(iso)
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        disabled={off}
                                        onClick={() => { emit(iso); setOpen(false) }}
                                        aria-label={formatDateEs(iso)}
                                        aria-pressed={isSel}
                                        className={`h-10 rounded-xl text-sm font-bold transition-colors ${isSel ? 'bg-indigo-600 text-white' : isToday ? 'text-indigo-600 ring-1 ring-indigo-200' : 'text-slate-700 hover:bg-slate-100'} disabled:text-slate-300 disabled:hover:bg-transparent`}
                                    >
                                        {d}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                            <button type="button" onClick={() => { emit(''); setOpen(false) }} className="px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">Borrar</button>
                            <button type="button" disabled={outOfRange(todayISO)} onClick={() => { emit(todayISO); setOpen(false) }} className="px-4 py-2 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40">Hoy</button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    )
}
