import React from 'react'
import { BookOpen, Plus, Loader2, Search } from 'lucide-react'

interface Template {
    id: string
    title: string
    educational_level: string
    purpose: string
    campo_formativo: string
    grade: string | number
}

interface TemplateBankModalProps {
    isOpen: boolean
    onClose: () => void
    loadingTemplates: boolean
    templates: Template[]
    applyTemplate: (template: Template) => Promise<void>
}

export const TemplateBankModal: React.FC<TemplateBankModalProps> = ({
    isOpen,
    onClose,
    loadingTemplates,
    templates,
    applyTemplate
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Banco de Plantillas NEM</h3>
                            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest">Ahorra tokens usando planeaciones pre-diseñadas</p>
                        </div>
                    </div>
                    <button aria-label="Agregar" onClick={onClose} className="p-3 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-2xl transition-colors">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar">
                    {loadingTemplates ? (
                        <div className="flex flex-col items-center py-20">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                            <p className="font-black text-slate-500 uppercase tracking-widest text-xs">Buscando en el catálogo...</p>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 rounded-[2rem]">
                            <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="font-bold text-slate-500">No se encontraron plantillas para este grado y asignatura.</p>
                        </div>
                    ) : (
                        templates.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => applyTemplate(t)}
                                className="w-full text-left p-6 bg-slate-50 border-2 border-transparent hover:border-indigo-200 hover:bg-indigo-50 rounded-3xl transition-all group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{t.title}</h4>
                                    <span className="px-3 py-1 bg-white rounded-full text-[11px] font-black text-indigo-400 border border-slate-100 uppercase">{t.educational_level}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{t.purpose}</p>
                                <div className="flex gap-2">
                                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100/50 px-2 py-0.5 rounded-md">{t.campo_formativo}</span>
                                    <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-100 px-2 py-0.5 rounded-md">{t.grade}° Grado</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}
