import React from 'react'
import { Briefcase, Search, Plus, CheckCircle2 } from 'lucide-react'
import { RESOURCE_CATALOG } from '../../../constants/planningConstants'

interface ResourceCatalogModalProps {
    isOpen: boolean
    onClose: () => void
    searchTerm: string
    onSearchChange: (term: string) => void
    selectedResources: string[]
    onToggleResource: (resource: string) => void
}

export const ResourceCatalogModal: React.FC<ResourceCatalogModalProps> = ({
    isOpen,
    onClose,
    searchTerm,
    onSearchChange,
    selectedResources,
    onToggleResource
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-[2.5rem] md:rounded-3xl w-full max-w-3xl shadow-2xl border border-emerald-100 overflow-hidden animate-in slide-in-from-bottom-10 md:fade-in md:zoom-in duration-300 flex flex-col h-[85vh] md:h-auto md:max-h-[95vh]">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-emerald-50/30 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center">
                            <Briefcase className="w-5 h-5 mr-3 text-emerald-700" />
                            Catálogo de Recursos de Aula
                        </h3>
                        <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mt-1">
                            Explora y selecciona los materiales necesarios para tu proyecto
                        </p>
                    </div>
                    <button aria-label="Agregar" onClick={onClose} className="text-gray-500 hover:text-gray-600">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-8 bg-emerald-50/10 border-b border-emerald-50">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                            <input
                                type="text"
                                placeholder="Buscar materiales (ej: proyector, hojas, libros...)"
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full bg-white border-2 border-emerald-50/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-emerald-200"
                            />
                        </div>
                    </div>

                    <div className="p-8 pt-0">
                        <div className="space-y-10">
                            {RESOURCE_CATALOG.map((cat) => {
                                const filteredItems = cat.items.filter(item =>
                                    item.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                if (filteredItems.length === 0) return null

                                return (
                                    <div key={cat.category}>
                                        <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.2em] mb-4 flex items-center pt-8">
                                            <span className="w-4 h-px bg-emerald-100 mr-2"></span>
                                            {cat.category}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {filteredItems.map((item) => {
                                                const isSelected = selectedResources.includes(item)
                                                return (
                                                    <button
                                                        key={item}
                                                        onClick={() => onToggleResource(item)}
                                                        className={`text-left p-3 rounded-xl border-2 transition-all flex items-center group
                                                            ${isSelected
                                                                ? 'bg-emerald-50 border-emerald-500 shadow-sm shadow-emerald-100/50'
                                                                : 'bg-white border-gray-50 hover:border-emerald-100 hover:bg-emerald-50/10'
                                                            }`}
                                                    >
                                                        <div className={`w-4 h-4 rounded flex items-center justify-center mr-3 shrink-0 border
                                                            ${isSelected ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-gray-200 text-transparent'}`}>
                                                            <CheckCircle2 className="w-3 h-3" />
                                                        </div>
                                                        <span className={`text-[11px] font-bold leading-tight ${isSelected ? 'text-emerald-900' : 'text-gray-500'}`}>
                                                            {item}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-emerald-700 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-800 transition-all"
                    >
                        Finalizar Selección
                    </button>
                </div>
            </div>
        </div>
    )
}
