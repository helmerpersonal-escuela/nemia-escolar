import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { wizardInput } from '../../../components/wizard/Wizard'
import { DateInput } from '../../../components/ui/DateInput'
import { STATUS_META, deliveredAt, type CoopDocument, type DocStatus } from '../lib/types'

export const inputSm = wizardInput.replace('px-4 py-3', 'px-3 py-2.5')

export const StatusBadge = ({ status }: { status: DocStatus }) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-black whitespace-nowrap ${STATUS_META[status]?.tone ?? ''}`}>
        {STATUS_META[status]?.label ?? status}
    </span>
)

/** Estado para mostrar: en espacio independiente no hay revisión, solo "En preparación" / "Entregado". */
export const DocBadge = ({ doc, independent }: { doc: CoopDocument; independent: boolean }) => {
    if (!independent) return <StatusBadge status={doc.status} />
    const done = !!deliveredAt(doc)
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-black whitespace-nowrap ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {done ? 'Entregado' : 'En preparación'}
        </span>
    )
}

export const Card = ({ title, icon: Icon, action, children, className = '' }: { title?: ReactNode; icon?: any; action?: ReactNode; children: ReactNode; className?: string }) => (
    <section className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 ${className}`}>
        {(title || action) && (
            <div className="flex items-center justify-between gap-3 mb-4">
                {title && (
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2 min-w-0">
                        {Icon && <Icon className="w-5 h-5 text-indigo-600 shrink-0" />}<span className="truncate">{title}</span>
                    </h3>
                )}
                {action}
            </div>
        )}
        {children}
    </section>
)

export const Kpi = ({ label, value, hint, tone = 'slate' }: { label: string; value: ReactNode; hint?: string; tone?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' }) => {
    const color = { slate: 'text-slate-900', indigo: 'text-indigo-700', emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' }[tone]
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className={`text-xl sm:text-2xl font-black ${color}`}>{value}</div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">{label}</div>
            {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
        </div>
    )
}

export const Btn = ({ children, onClick, tone = 'secondary', disabled, icon: Icon, className = '', type = 'button', title }: {
    children?: ReactNode; onClick?: () => void; tone?: 'primary' | 'secondary' | 'success' | 'warning' | 'ghost' | 'danger'; disabled?: boolean; icon?: any; className?: string; type?: 'button' | 'submit'; title?: string
}) => {
    const styles = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
        warning: 'bg-amber-500 text-white hover:bg-amber-600',
        secondary: 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700',
        ghost: 'text-slate-600 hover:bg-slate-100',
        danger: 'text-rose-600 hover:bg-rose-50',
    }[tone]
    return (
        <button type={type} title={title} onClick={onClick} disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-black transition disabled:opacity-40 ${styles} ${className}`}>
            {Icon && <Icon className="w-4 h-4 shrink-0" />}{children}
        </button>
    )
}

export const Empty = ({ icon: Icon, title, text, action }: { icon: any; title: string; text?: string; action?: ReactNode }) => (
    <div className="text-center py-10 px-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3"><Icon className="w-7 h-7" /></div>
        <p className="font-black text-slate-900">{title}</p>
        {text && <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{text}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
)

// ---------------------------------------------------------------------------
// Editor de renglones (tarjetas apiladas: funciona igual en celular y computadora)

export interface RowField<T> {
    key: keyof T & string
    label: string
    type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'months'
    options?: string[]
    span?: 1 | 2 | 3 | 4 | 6
    placeholder?: string
    suffix?: string
}

const spanClass = { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-2 sm:col-span-3', 4: 'col-span-2 sm:col-span-4', 6: 'col-span-2 sm:col-span-6' } as const

export function RowsEditor<T extends Record<string, any>>({ rows, fields, onChange, newRow, addLabel = 'Agregar renglón', readOnly, footer, title, options }: {
    rows: T[]
    fields: RowField<T>[]
    onChange: (rows: T[]) => void
    newRow: () => T
    addLabel?: string
    readOnly?: boolean
    footer?: (row: T, i: number) => ReactNode
    title?: (row: T, i: number) => ReactNode
    options?: { months?: string[] }
}) {
    const update = (i: number, patch: Partial<T>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
    return (
        <div className="space-y-3">
            {rows.map((row, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-black text-slate-500">{title ? title(row, i) : `Renglón ${i + 1}`}</span>
                        {!readOnly && (
                            <button type="button" aria-label="Quitar renglón" onClick={() => onChange(rows.filter((_, k) => k !== i))} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                        {fields.map(f => (
                            <label key={f.key} className={spanClass[f.span ?? 2]}>
                                <span className="block text-[11px] font-black text-slate-500 mb-1">{f.label}</span>
                                <FieldInput field={f} value={row[f.key]} readOnly={readOnly} months={options?.months} onChange={v => update(i, { [f.key]: v } as Partial<T>)} />
                            </label>
                        ))}
                    </div>
                    {footer && <div className="mt-2.5 text-xs font-bold text-slate-600">{footer(row, i)}</div>}
                </div>
            ))}
            {!readOnly && (
                <button type="button" onClick={() => onChange([...rows, newRow()])}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-black text-slate-500 hover:border-indigo-300 hover:text-indigo-700 flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> {addLabel}
                </button>
            )}
        </div>
    )
}

function FieldInput<T>({ field, value, onChange, readOnly, months = [] }: { field: RowField<T>; value: any; onChange: (v: any) => void; readOnly?: boolean; months?: string[] }) {
    if (field.type === 'months') {
        const sel: string[] = Array.isArray(value) ? value : []
        return (
            <div className="flex flex-wrap gap-1.5">
                {months.map(m => {
                    const on = sel.includes(m)
                    return (
                        <button key={m} type="button" disabled={readOnly} onClick={() => onChange(on ? sel.filter(x => x !== m) : [...sel, m])}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                            {m}
                        </button>
                    )
                })}
            </div>
        )
    }
    if (field.type === 'select') {
        return (
            <select className={inputSm} disabled={readOnly} value={value ?? ''} onChange={e => onChange(e.target.value)}>
                {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        )
    }
    if (field.type === 'date') {
        return <DateInput className={inputSm} disabled={readOnly} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    }
    if (field.type === 'textarea') {
        return <textarea className={`${inputSm} min-h-[72px] resize-y`} readOnly={readOnly} value={value ?? ''} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />
    }
    if (field.type === 'number') {
        return (
            <input className={inputSm} readOnly={readOnly} inputMode="decimal" type="number" step="any" min="0" value={value ?? ''} placeholder={field.placeholder}
                onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
        )
    }
    return <input className={inputSm} readOnly={readOnly} value={value ?? ''} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />
}
