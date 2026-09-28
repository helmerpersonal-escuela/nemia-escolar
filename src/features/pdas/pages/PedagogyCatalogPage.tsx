import { useSearchParams } from 'react-router-dom'
import { BookMarked, Compass, Route as RouteIcon } from 'lucide-react'
import { CustomPdasPage } from './CustomPdasPage'
import { OfficialPdasSection } from '../components/OfficialPdasSection'
import { CatalogItemsSection } from '../components/CatalogItemsSection'

const TABS = [
    { id: 'pdas', label: 'PDAs', icon: BookMarked },
    { id: 'ejes', label: 'Ejes articuladores', icon: Compass },
    { id: 'metodologias', label: 'Metodologías', icon: RouteIcon },
] as const

/** PDAs (oficiales + propios), ejes articuladores y metodologías: lo que se elige al planear y al crear instrumentos. */
export const PedagogyCatalogPage = () => {
    const [params, setParams] = useSearchParams()
    const tab = (TABS.find(t => t.id === params.get('tab'))?.id ?? 'pdas') as typeof TABS[number]['id']
    return (
        <div className="max-w-5xl mx-auto px-3 sm:px-0 pb-20 space-y-6">
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Codiseño · Nueva Escuela Mexicana</p>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">PDAs, ejes y metodologías</h1>
                <p className="text-sm text-slate-500 mt-1 max-w-2xl">Lo oficial de la SEP más lo que tú o tu comunidad escolar construyen. Oculta lo que no uses; lo demás aparece al planear y al crear instrumentos.</p>
            </div>
            <div role="tablist" aria-label="Catálogo" className="flex gap-2 overflow-x-auto pb-1">
                {TABS.map(t => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setParams({ tab: t.id }, { replace: true })}
                        className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-black ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-100 text-slate-600'}`}>
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>
            {tab === 'pdas' && (
                <div className="space-y-10">
                    <OfficialPdasSection />
                    <CustomPdasPage />
                </div>
            )}
            {tab === 'ejes' && <CatalogItemsSection kind="EJE" />}
            {tab === 'metodologias' && <CatalogItemsSection kind="METODOLOGIA" />}
        </div>
    )
}
