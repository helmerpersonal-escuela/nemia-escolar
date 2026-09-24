import React from 'react'
import { BookOpen, Plus } from 'lucide-react'

interface ProgramContent {
    id: string
    campo_formativo: string
    custom_content: string
    ejes_articuladores: string[]
    pda_ids: string[]
    temporality: string
}

interface ProgramContentModalProps {
    isOpen: boolean
    onClose: () => void
    programContents: ProgramContent[]
    onSelectContent: (content: ProgramContent) => void
}

export const ProgramContentModal: React.FC<ProgramContentModalProps> = ({
    isOpen,
    onClose,
    programContents,
    onSelectContent
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-end md:items-center justify-center p-0 md:p-6">
            <div className="bg-white rounded-t-[2.5rem] md:rounded-[2rem] w-full md:max-w-4xl shadow-2xl animate-in slide-in-from-bottom-10 md:fade-in md:zoom-in duration-300 h-[85vh] md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-start mb-6 md:mb-8 p-6 md:p-10 pb-0 md:pb-0">
                    <div className="flex items-center">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mr-4 md:mr-5 shadow-xl shadow-indigo-100 shrink-0">
                            <BookOpen className="w-6 h-6 md:w-7 md:h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Vincular Programa Analítico</h3>
                            <p className="text-indigo-600 text-[11px] md:text-xs font-bold uppercase tracking-widest mt-1">Selecciona los contenidos contextualizados</p>
                        </div>
                    </div>
                    <button aria-label="Agregar" onClick={onClose} className="bg-gray-50 p-2 rounded-xl text-gray-500 hover:text-gray-900 transition-colors">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 md:px-10 py-4 space-y-4 custom-scrollbar">
                    {programContents.length === 0 ? (
                        <div className="py-20 text-center text-gray-500 font-bold uppercase text-xs">
                            No hay contenidos programáticos disponibles.
                        </div>
                    ) : (
                        programContents.map((content) => (
                            <div
                                key={content.id}
                                onClick={() => onSelectContent(content)}
                                className="p-5 md:p-6 rounded-2xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest">
                                        {content.campo_formativo || 'Campo no definido'}
                                    </span>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase">{content.temporality}</span>
                                </div>
                                <h4 className="font-bold text-gray-900 text-sm mb-3 group-hover:text-indigo-700 transition-colors">{content.custom_content}</h4>
                                <div className="flex flex-wrap gap-2">
                                    {(content.ejes_articuladores || []).map((eje: string) => (
                                        <span key={eje} className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[11px] font-bold uppercase">{eje}</span>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 md:p-10 pt-4 md:pt-6 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="w-full md:w-auto px-8 py-3 rounded-xl font-bold text-gray-500 hover:text-gray-900 transition-all bg-gray-50 md:bg-transparent"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}
