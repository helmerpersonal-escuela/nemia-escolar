import React from 'react'
import { BookOpen, ExternalLink, Plus } from 'lucide-react'

interface PdfViewerModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    pagesFrom: string | number | null
    pagesTo: string | number | null
    pdfUrl: string
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
    isOpen,
    onClose,
    title,
    pagesFrom,
    pagesTo,
    pdfUrl
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex flex-col no-print">
            <div className="flex justify-between items-center p-6 bg-white/5 border-b border-white/10">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-white font-black uppercase text-sm tracking-tight">
                            {title || 'Visualizador de Libro'}
                        </h3>
                        <p className="text-[11px] text-indigo-300 font-bold uppercase tracking-widest mt-1">
                            Páginas {pagesFrom || '?'} a {pagesTo || '?'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-black uppercase transition-all"
                    >
                        <ExternalLink className="w-4 h-4" />
                        <span>Abrir en Nueva Pestaña</span>
                    </a>
                    <button aria-label="Agregar"
                        onClick={onClose}
                        className="bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white p-3 rounded-2xl transition-all"
                    >
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>
            </div>
            <div className="flex-1 bg-slate-800 relative overflow-hidden">
                <iframe
                    src={pdfUrl}
                    className="w-full h-full border-none"
                    title="PDF Viewer"
                />
            </div>
        </div>
    )
}
