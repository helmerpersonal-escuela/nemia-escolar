import { Plus, X } from 'lucide-react'
import { newAgreement, type Agreement } from '../../lib/agreements'
import { DateInput, formatDateEs } from './DateInput'

const field = 'min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:border-indigo-400 outline-none'

/** Lista editable de pactos y acuerdos: qué se acordó, quién responde, para cuándo y si ya se cumplió. */
export const AgreementsEditor = ({ value, onChange, disabled, responsibleHint = 'Responsable' }: { value: Agreement[]; onChange: (v: Agreement[]) => void; disabled?: boolean; responsibleHint?: string }) => {
    const set = (id: string, patch: Partial<Agreement>) => onChange(value.map(a => a.id === id ? { ...a, ...patch } : a))
    const today = new Date().toISOString().slice(0, 10)
    return (
        <div className="space-y-2">
            {value.length === 0 && <p className="text-sm text-slate-500">Todavía no hay acuerdos.</p>}
            {value.map((a, i) => {
                const overdue = !a.done_at && !!a.due_date && a.due_date < today
                return (
                    <div key={a.id} className={`border rounded-2xl p-3 space-y-2 ${a.done_at ? 'border-emerald-200 bg-emerald-50/40' : overdue ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                        <div className="flex gap-2">
                            <textarea aria-label={`Acuerdo ${i + 1}`} rows={2} value={a.text} disabled={disabled} onChange={e => set(a.id, { text: e.target.value })} placeholder="Qué se acordó" className={`${field} flex-1 py-2 resize-y`} />
                            {!disabled && <button type="button" onClick={() => onChange(value.filter(x => x.id !== a.id))} aria-label={`Quitar acuerdo ${i + 1}`} className="p-2 h-11 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><X className="w-4 h-4" /></button>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <input aria-label={`Responsable del acuerdo ${i + 1}`} value={a.responsible} disabled={disabled} onChange={e => set(a.id, { responsible: e.target.value })} placeholder={responsibleHint} className={`${field} flex-1 min-w-40`} />
                            <DateInput aria-label={`Fecha del acuerdo ${i + 1}`} value={a.due_date ?? ''} disabled={disabled} onChange={e => set(a.id, { due_date: e.target.value || null })} placeholder="Fecha de revisión" className="w-48" />
                            <label className="inline-flex items-center gap-2 min-h-11 px-3 rounded-xl text-sm font-bold text-slate-700 cursor-pointer">
                                <input type="checkbox" className="accent-emerald-600 w-4 h-4" checked={!!a.done_at} disabled={disabled} onChange={e => set(a.id, { done_at: e.target.checked ? today : null })} />
                                {a.done_at ? `Cumplido el ${formatDateEs(a.done_at, true)}` : overdue ? 'Vencido, sin cumplir' : 'Cumplido'}
                            </label>
                        </div>
                    </div>
                )
            })}
            {!disabled && <button type="button" onClick={() => onChange([...value, newAgreement()])} className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100"><Plus className="w-4 h-4" /> Agregar acuerdo</button>}
        </div>
    )
}
