import React from 'react'
import {
    BookOpen,
    Search,
    Eye,
    Sparkles,
    BookMarked,
    FileText,
    CheckCircle2,
    Plus,
} from 'lucide-react'
import { PDFUpload } from '../../../../components/common/PDFUpload'
import { supabase } from '../../../../lib/supabase'

import type { LessonPlanFormData } from '../../types/planning.types'

interface Textbook {
    id: string
    title: string
    file_url: string
    field_of_study?: string
    created_at?: string
    source?: string
    reader_url?: string | null
    text_status?: string
}

const CAMPOS = ['lenguajes', 'saberes y pensamiento cientifico', 'etica, naturaleza y sociedades', 'de lo humano y lo comunitario']
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

interface Step2ResourcesProps {
    formData: LessonPlanFormData
    setFormData: React.Dispatch<React.SetStateAction<LessonPlanFormData>>
    isPreviewMode: boolean
    availableTextbooks: Textbook[]
    personalTextbooks: Textbook[]
    setPersonalTextbooks: React.Dispatch<React.SetStateAction<Textbook[]>>
    triggerThemeGeneration: (bookTitle?: string, extractedText?: string) => Promise<void>
    isExtractingText: boolean
    extractSpecificPages: (fileUrl: string, from: number, to: number) => Promise<void>
    generatingThemes: boolean
    textbookThemesProposal: any[]
    toggleThemeSelection: (theme: string) => void
    setIsPdfViewerOpen: (open: boolean) => void
    setPdfViewerUrl: (url: string) => void
}

export const Step2Resources: React.FC<Step2ResourcesProps> = ({
    formData,
    setFormData,
    isPreviewMode,
    availableTextbooks,
    personalTextbooks,
    setPersonalTextbooks,
    triggerThemeGeneration,
    isExtractingText,
    extractSpecificPages,
    generatingThemes,
    textbookThemesProposal,
    toggleThemeSelection,
    setIsPdfViewerOpen,
    setPdfViewerUrl
}) => {
    if (isPreviewMode) {
        return (
            <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50 p-8 rounded-[2rem] border border-gray-100">
                    <div className="col-span-full mb-4">
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center">
                            <BookOpen className="w-4 h-4 mr-2" />
                            Recursos y Materiales
                        </h3>
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Libro de Texto</p>
                        <p className="font-bold text-gray-900">
                            {formData.textbook_id
                                ? availableTextbooks.find(b => b.id === formData.textbook_id)?.title
                                : formData.source_document_url ? 'Documento Personal' : 'No seleccionado'}
                        </p>
                    </div>
                    {formData.textbook_pages_from && (
                        <div>
                            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Páginas</p>
                            <p className="font-bold text-gray-900">{formData.textbook_pages_from} - {formData.textbook_pages_to}</p>
                        </div>
                    )}
                    <div className="col-span-full">
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Temas Seleccionados</p>
                        <div className="flex flex-wrap gap-2">
                            {(formData.selected_themes || []).map((theme: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-white border border-indigo-100 text-indigo-700 rounded-full text-[11px] font-bold">
                                    {theme}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        )
    }

    return (
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
            <div className="flex items-center space-x-3 mb-8">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100">
                    <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Paso 02. Libro de Texto e Insumos</h2>
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mt-1">Selecciona el contenido base de tus actividades</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                        <h3 className="text-xs font-black text-indigo-950 uppercase tracking-widest mb-6 flex items-center">
                            <Search className="w-4 h-4 mr-2 text-indigo-400" />
                            Seleccionar Libro Oficial
                        </h3>
                        <select
                            value={formData.textbook_id}
                            onChange={async (e) => {
                                const bookId = e.target.value
                                setFormData((prev: any) => ({ ...prev, textbook_id: bookId }))

                                if (bookId) {
                                    const book = availableTextbooks.find(b => b.id === bookId)
                                    if (book) {
                                        triggerThemeGeneration(book.title)
                                    }
                                } else {
                                    // setTextbookThemesProposal is managed by parent, but parent passed triggerThemeGeneration
                                    // we might need a way to clear proposal. For now let's assume parent handles it or we pass a clear function.
                                    // Parent's triggerThemeGeneration handles generation.
                                }
                            }}
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Seleccionar Libro CONALITEG</option>
                            {availableTextbooks.filter(book => {
                                if (!formData.campo_formativo) return true
                                const bField = norm(book.field_of_study || '')
                                const fField = norm(formData.campo_formativo)
                                // Libros de otro campo formativo se ocultan; los generales (proyectos, maestro, etc.) se muestran.
                                if (!bField || !CAMPOS.some(c => bField.includes(c))) return true
                                return bField.includes(fField) || fField.includes(bField)
                            }).map(book => (
                                <option key={book.id} value={book.id}>{book.title}</option>
                            ))}
                        </select>

                        {(formData.textbook_id || formData.source_document_url) && (
                            <div className="mt-6 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex flex-col space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Contexto Específico</h4>
                                        <button
                                            onClick={() => {
                                                const official = !formData.source_document_url ? availableTextbooks.find(b => b.id === formData.textbook_id) : undefined
                                                if (official?.reader_url) {
                                                    window.open(official.reader_url, '_blank', 'noopener')
                                                    return
                                                }
                                                const url = formData.source_document_url || availableTextbooks.find(b => b.id === formData.textbook_id)?.file_url
                                                if (url) {
                                                    setPdfViewerUrl(url)
                                                    setIsPdfViewerOpen(true)
                                                }
                                            }}
                                            className="flex items-center space-x-2 text-[11px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                                        >
                                            <Eye className="w-3 h-3" />
                                            <span>Ver Libro</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Página Desde</label>
                                            <input aria-label="Página Desde"
                                                type="number"
                                                min="1"
                                                value={formData.textbook_pages_from}
                                                onChange={e => setFormData((prev: any) => ({ ...prev, textbook_pages_from: e.target.value }))}
                                                className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-200 transition-all"
                                                placeholder="Ej: 12"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Página Hasta</label>
                                            <input aria-label="Página Hasta"
                                                type="number"
                                                min="1"
                                                value={formData.textbook_pages_to}
                                                onChange={e => setFormData((prev: any) => ({ ...prev, textbook_pages_to: e.target.value }))}
                                                className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-200 transition-all"
                                                placeholder="Ej: 15"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            const url = formData.source_document_url || availableTextbooks.find(b => b.id === formData.textbook_id)?.file_url
                                            const from = parseInt(formData.textbook_pages_from || '')
                                            const to = parseInt(formData.textbook_pages_to || '')
                                            if (url && from && to) {
                                                await extractSpecificPages(url, from, to)
                                            } else {
                                                alert('Por favor indica el rango de páginas y asegúrate de tener un libro seleccionado.')
                                            }
                                        }}
                                        disabled={isExtractingText || !formData.textbook_pages_from || !formData.textbook_pages_to}
                                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 flex items-center justify-center space-x-2"
                                    >
                                        {isExtractingText ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>Leyendo páginas...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3 h-3" />
                                                <span>Usar estas páginas para la planeación</span>
                                            </>
                                        )}
                                    </button>

                                    {(() => {
                                        const official = !formData.source_document_url ? availableTextbooks.find(b => b.id === formData.textbook_id) : undefined
                                        if (!official || official.source !== 'CONALITEG' || official.text_status === 'done') return null
                                        return (
                                            <div className="space-y-2">
                                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                                    CONALITEG protege este PDF. Abre "Ver libro", copia el texto de las páginas y pégalo aquí para que la IA lo use.
                                                </p>
                                                <textarea
                                                    value={formData.extracted_text || ''}
                                                    onChange={e => setFormData(prev => ({ ...prev, extracted_text: e.target.value }))}
                                                    rows={4}
                                                    placeholder="Pega aquí el texto de las páginas del libro"
                                                    className="w-full bg-white border-2 border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-200"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => triggerThemeGeneration(official.title, formData.extracted_text)}
                                                    disabled={!formData.extracted_text || formData.extracted_text.length < 50}
                                                    className="w-full py-2 px-4 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40"
                                                >
                                                    Usar el texto pegado
                                                </button>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        )}

                        <div className="mt-8 border-t-2 border-slate-50 pt-8">
                            <h3 className="text-xs font-black text-indigo-950 uppercase tracking-widest mb-4 flex items-center">
                                <BookMarked className="w-4 h-4 mr-2 text-indigo-400" />
                                Mi Biblioteca Personal
                            </h3>

                            {personalTextbooks.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                                    {personalTextbooks.map(book => (
                                        <div
                                            key={book.id}
                                            onClick={() => {
                                                setFormData((prev: any) => ({
                                                    ...prev,
                                                    source_document_url: book.file_url,
                                                    textbook_id: '',
                                                    textbook_pages_from: '',
                                                    textbook_pages_to: ''
                                                }))
                                            }}
                                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center shadow-sm ${formData.source_document_url === book.file_url && !formData.textbook_id
                                                ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                                                : 'bg-white border-slate-100 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${formData.source_document_url === book.file_url && !formData.textbook_id
                                                ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{book.title}</p>
                                                <p className="text-[11px] font-black text-slate-500 tracking-widest uppercase">
                                                    {book.created_at ? new Date(book.created_at).toLocaleDateString() : 'Desconocido'}
                                                </p>
                                            </div>
                                            {formData.source_document_url === book.file_url && !formData.textbook_id && (
                                                <CheckCircle2 className="w-4 h-4 text-indigo-600 ml-2" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic mb-6">Aún no has guardado libros en tu biblioteca.</p>
                            )}

                            <h3 className="text-xs font-black text-indigo-950 uppercase tracking-widest mb-4 flex items-center">
                                <Plus className="w-4 h-4 mr-2 text-indigo-400" />
                                Subir Nuevo Libro (PDF)
                            </h3>
                            <PDFUpload
                                label="Subir PDF del Libro"
                                bucket="textbooks"
                                currentFileUrl={formData.source_document_url}
                                onUploadComplete={async (url, text, fileName) => {
                                    // Guardar en repositorio personal
                                    const { data: { user } } = await supabase.auth.getUser()
                                    if (user) {
                                        const { data: newBook } = await supabase.from('user_textbooks').insert({
                                            profile_id: user.id,
                                            title: fileName || 'Libro Personalizado',
                                            file_url: url
                                        }).select().single()

                                        if (newBook) {
                                            setPersonalTextbooks(prev => [newBook, ...prev])
                                        }
                                    }

                                    setFormData((prev: any) => ({
                                        ...prev,
                                        source_document_url: url,
                                        extracted_text: text,
                                        textbook_id: ''
                                    }))

                                    if (text) {
                                        triggerThemeGeneration(undefined, text)
                                    }
                                }}
                                onClear={() => {
                                    setFormData((prev: any) => ({
                                        ...prev,
                                        source_document_url: '',
                                        extracted_text: '',
                                        textbook_pages_from: '',
                                        textbook_pages_to: ''
                                    }))
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group min-h-[300px]">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles className="w-32 h-32 text-indigo-400" />
                        </div>

                        <div className="relative z-10">
                            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Análisis Inteligente (IA)</h3>
                            <h4 className="text-xl font-bold text-white mb-6">Temas detectados en el recurso</h4>

                            {generatingThemes ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-xs font-black text-indigo-300 uppercase tracking-widest animate-pulse">Analizando PDF...</p>
                                </div>
                            ) : textbookThemesProposal.length > 0 ? (
                                <div className="space-y-3">
                                    {textbookThemesProposal.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => toggleThemeSelection(item.theme)}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 ${(formData.selected_themes || []).includes(item.theme)
                                                ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-600/20'
                                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                                                }`}
                                        >
                                            <div className="flex items-center space-x-3 text-left">
                                                <div className={`p-2 rounded-lg ${(formData.selected_themes || []).includes(item.theme) ? 'bg-white/20' : 'bg-white/5'}`}>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold uppercase tracking-tight">{item.theme}</span>
                                            </div>
                                            <span className="text-[11px] font-black opacity-60 bg-black/20 px-3 py-1 rounded-full uppercase">{item.pages}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-[2rem] p-12 text-center">
                                    <p className="text-indigo-300/40 font-bold italic text-sm">Selecciona o sube un libro para que la IA proponga los temas clave aquí.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
