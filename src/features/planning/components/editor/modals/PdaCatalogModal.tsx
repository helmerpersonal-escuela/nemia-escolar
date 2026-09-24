import React from 'react'
import { BookMarked, Plus, CheckCircle2 } from 'lucide-react'
import { PDA_CATALOG } from '../../../constants/planningConstants'

interface PdaCatalogModalProps {
    isOpen: boolean
    onClose: () => void
    campoFormativo: string
    selectedPdas: string[]
    onTogglePda: (pda: string) => void
}

export const PdaCatalogModal: React.FC<PdaCatalogModalProps> = ({
    isOpen,
    onClose,
    campoFormativo,
    selectedPdas,
    onTogglePda
}) => {
    if (!isOpen) return null

    const catalogItems = PDA_CATALOG[campoFormativo as keyof typeof PDA_CATALOG] || []

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-[2.5rem] md:rounded-3xl w-full max-w-2xl shadow-2xl border border-indigo-100 overflow-hidden animate-in slide-in-from-bottom-10 md:fade-in md:zoom-in duration-300 flex flex-col h-[85vh] md:h-auto md:max-h-[95vh]">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-indigo-50/30 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center">
                            <BookMarked className="w-5 h-5 mr-3 text-indigo-600" />
                            Catálogo de PDAs: {campoFormativo}
                        </h3>
                        <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mt-1">
                            Selecciona los procesos que deseas incluir en tu planeación
                        </p>
                    </div>
                    <button aria-label="Agregar" onClick={onClose} className="text-gray-500 hover:text-gray-600">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                    {catalogItems.length === 0 ? (
                        <div className="py-10 text-center text-gray-500 font-bold">
                            No hay PDAs disponibles para este campo formativo.
                        </div>
                    ) : (
                        catalogItems.map((pdaOption) => {
                            const isSelected = selectedPdas.includes(pdaOption)
                            return (
                                <button
                                    key={pdaOption}
                                    onClick={() => onTogglePda(pdaOption)}
                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start group
                                        ${isSelected
                                            ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-100/50'
                                            : 'bg-white border-gray-50 hover:border-indigo-200 hover:bg-gray-50/50'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center mr-4 shrink-0 mt-0.5 border
                                        ${isSelected ? 'bg-indigo-500 border-indigo-600 text-white' : 'bg-white border-gray-200 text-transparent'}`}>
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <span className={`text-sm font-medium leading-relaxed ${isSelected ? 'text-indigo-900 font-bold' : 'text-gray-600'}`}>
                                        {pdaOption}
                                    </span>
                                </button>
                            )
                        })
                    )}
                </div>
                <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                    >
                        Listo
                    </button>
                </div>
            </div>
        </div>
    )
}
