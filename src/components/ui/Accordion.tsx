import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'

/**
 * Secciones plegables. Por defecto solo hay una abierta: al abrir otra se cierra la anterior.
 * "Expandir todo" las abre todas y, desde ahí, cada una se abre o cierra por separado.
 */
export function useAccordion(ids: readonly string[], initial: string | null = ids[0] ?? null) {
    const [open, setOpen] = useState<string[]>(initial ? [initial] : [])
    const [multi, setMulti] = useState(false)
    return {
        isOpen: (id: string) => open.includes(id),
        toggle: (id: string) => setOpen(o => o.includes(id) ? o.filter(x => x !== id) : multi ? [...o, id] : [id]),
        allOpen: open.length === ids.length,
        expandAll: () => { setMulti(true); setOpen([...ids]) },
        collapseAll: () => { setMulti(false); setOpen([]) },
    }
}

export const AccordionToggleAll = ({ acc }: { acc: ReturnType<typeof useAccordion> }) => (
    <button type="button" onClick={acc.allOpen ? acc.collapseAll : acc.expandAll}
        className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl text-xs font-black text-indigo-700 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
        {acc.allOpen ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
        {acc.allOpen ? 'Colapsar todo' : 'Expandir todo'}
    </button>
)

interface SectionProps { title: string; summary?: ReactNode; tone?: 'normal' | 'warn'; open: boolean; onToggle: () => void; children: ReactNode }

export const AccordionSection = ({ title, summary, tone = 'normal', open, onToggle, children }: SectionProps) => {
    const id = useId()
    return (
        <section className={`border rounded-2xl transition-colors ${open ? 'border-indigo-200 bg-white' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
            <h3>
                <button type="button" id={`${id}-h`} aria-expanded={open} aria-controls={`${id}-p`} onClick={onToggle}
                    className={`w-full flex items-center gap-3 min-h-14 px-4 py-2 text-left rounded-2xl transition-colors hover:bg-indigo-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${open ? 'bg-indigo-50/40' : ''}`}>
                    <span className="font-black text-slate-900 shrink-0">{title}</span>
                    {/* El resumen solo hace falta con la sección cerrada */}
                    <span className={`flex-1 min-w-0 truncate text-sm font-bold text-right transition-opacity duration-200 ${open ? 'opacity-0' : 'opacity-100'} ${tone === 'warn' ? 'text-amber-700' : 'text-slate-500'}`} aria-hidden={open}>{summary}</span>
                    <ChevronDown className={`w-5 h-5 shrink-0 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
            </h3>
            {/* De 0fr a 1fr: la altura se anima sin medir el contenido */}
            <div id={`${id}-p`} role="region" aria-labelledby={`${id}-h`} className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
                <div className="overflow-hidden min-h-0" inert={!open}>
                    <div className="px-4 pb-4 pt-2">{children}</div>
                </div>
            </div>
        </section>
    )
}
