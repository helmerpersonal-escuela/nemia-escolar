import React from 'react'
import { Sparkles, Plus } from 'lucide-react'

import type { AiSuggestion } from '../../../types/planning.types'

interface AiSuggestionsModalProps {
    isOpen: boolean
    onClose: () => void
    generating: boolean
    aiSuggestions: AiSuggestion[]
    selectedAiProposalIdx: number | null
    setSelectedAiProposalIdx: (idx: number | null) => void
    applyAiSuggestion: (suggestion: AiSuggestion) => Promise<void>
    generateAiSuggestions: () => Promise<void>
    setAiSuggestions: React.Dispatch<React.SetStateAction<AiSuggestion[]>>
}

export const AiSuggestionsModal: React.FC<AiSuggestionsModalProps> = ({
    isOpen,
    onClose,
    generating,
    aiSuggestions,
    selectedAiProposalIdx,
    setSelectedAiProposalIdx,
    applyAiSuggestion,
    generateAiSuggestions,
    setAiSuggestions
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white w-full md:max-w-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl border border-indigo-100 p-6 md:p-10 animate-in slide-in-from-bottom-10 md:zoom-in duration-300 overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[95vh]">
                <div className="flex justify-between items-center mb-8 shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                            <Sparkles className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">Asistente IA</h3>
                            <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Sugerencias Pedagógicas</p>
                        </div>
                    </div>
                    <button aria-label="Agregar" onClick={() => { onClose(); setSelectedAiProposalIdx(null); }} className="bg-gray-50 p-2 rounded-xl text-gray-500 hover:text-gray-900 transition-colors">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {selectedAiProposalIdx === null ? (
                        <>
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-6 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                Selecciona una propuesta para revisarla y editarla antes de aplicarla.
                            </p>

                            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                {!Array.isArray(aiSuggestions) || aiSuggestions.length === 0 ? (
                                    <div className="space-y-3 text-center py-10">
                                        {generating ? (
                                            <div className="space-y-3">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="h-24 bg-gray-50 rounded-2xl animate-pulse"></div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 font-bold uppercase text-[11px]">No hay sugerencias generadas.</p>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {aiSuggestions.map((suggestion, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedAiProposalIdx(idx)}
                                                className="w-full text-left p-5 rounded-3xl bg-white border-2 border-gray-50 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group scale-in-center shadow-sm"
                                            >
                                                <div className="flex items-start">
                                                    <div className="p-2 bg-indigo-50 rounded-lg mr-4 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white transition-colors">
                                                        <Sparkles className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-gray-800 group-hover:text-indigo-600 transition-colors">{suggestion.title}</p>
                                                        <p className="text-[11px] text-gray-500 mt-1 uppercase font-bold">Haz clic para ver fases y editar</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                        <div className="pt-4">
                                            <button
                                                onClick={generateAiSuggestions}
                                                disabled={generating}
                                                className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 font-bold text-sm transition-all"
                                            >
                                                {generating ? 'Generando nuevas opciones...' : '+ Solicitar otras estrategias'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-3 custom-scrollbar">
                                <div>
                                    <label className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Título de la Propuesta</label>
                                    <input aria-label="Título de la Propuesta"
                                        value={aiSuggestions[selectedAiProposalIdx].title}
                                        onChange={e => {
                                            const newSugs = [...aiSuggestions]
                                            newSugs[selectedAiProposalIdx].title = e.target.value
                                            setAiSuggestions(newSugs)
                                        }}
                                        className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2 font-bold text-gray-800 outline-none focus:border-indigo-200 transition-all"
                                    />
                                </div>

                                <div className="space-y-6 pt-4">
                                    {aiSuggestions[selectedAiProposalIdx].sessions?.map((sessionSug, sIdx) => (
                                        <div key={sIdx} className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 space-y-4">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-[11px] font-black">
                                                    {sIdx + 1}
                                                </div>
                                                <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">
                                                    Sesión: {sessionSug.date}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <label className="text-[11px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Apertura</label>
                                                    <textarea aria-label="Apertura"
                                                        value={sessionSug.apertura}
                                                        onChange={e => {
                                                            const newSugs = [...aiSuggestions]
                                                            newSugs[selectedAiProposalIdx].sessions[sIdx].apertura = e.target.value
                                                            setAiSuggestions(newSugs)
                                                        }}
                                                        rows={2}
                                                        className="w-full bg-white border-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 leading-relaxed outline-none focus:border-indigo-100 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Desarrollo</label>
                                                    <textarea aria-label="Desarrollo"
                                                        value={sessionSug.desarrollo}
                                                        onChange={e => {
                                                            const newSugs = [...aiSuggestions]
                                                            newSugs[selectedAiProposalIdx].sessions[sIdx].desarrollo = e.target.value
                                                            setAiSuggestions(newSugs)
                                                        }}
                                                        rows={3}
                                                        className="w-full bg-white border-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 leading-relaxed outline-none focus:border-indigo-100 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Cierre</label>
                                                    <textarea aria-label="Cierre"
                                                        value={sessionSug.cierre}
                                                        onChange={e => {
                                                            const newSugs = [...aiSuggestions]
                                                            newSugs[selectedAiProposalIdx].sessions[sIdx].cierre = e.target.value
                                                            setAiSuggestions(newSugs)
                                                        }}
                                                        rows={2}
                                                        className="w-full bg-white border-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 leading-relaxed outline-none focus:border-indigo-100 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex space-x-4 pt-4 border-t border-gray-100 shrink-0">
                                <button
                                    onClick={() => setSelectedAiProposalIdx(null)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    Volver al listado
                                </button>
                                <button
                                    onClick={() => applyAiSuggestion(aiSuggestions[selectedAiProposalIdx])}
                                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                >
                                    Aplicar sugerencia validada
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
