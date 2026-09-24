import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    BookOpen,
    Upload,
    Trash2,
    Search,
    Loader2,
    FileText,
    CheckCircle2
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

// Worker setup for PDF.js - Same as PDFUpload.tsx
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface SyntheticProgram {
    id: string
    phase: number
    file_name: string
    file_url: string
    created_at: string
}

export const SyntheticProgramsManager = () => {
    const [programs, setPrograms] = useState<SyntheticProgram[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const [newProgram, setNewProgram] = useState({
        phase: 6 // Default to Secundaria
    })
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    useEffect(() => {
        fetchPrograms()
    }, [])

    const fetchPrograms = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('synthetic_programs_pdfs')
                .select('id, phase, file_name, file_url, created_at') // Exclude extracted text from list
                .order('phase', { ascending: true })

            if (error) throw error
            setPrograms(data || [])
        } catch (error: any) {
            console.error('Error fetching synthetic programs:', error)
            alert('Error al cargar programas sintéticos: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    // Extract text from PDF (Uncapped for Synthetic Programs to gather max context)
    const extractText = async (file: File): Promise<string> => {
        console.log('[SyntheticPrograms] Iniciando extracción de texto para:', file.name, `(${file.size} bytes)`)
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let fullText = ''

        console.log('[SyntheticPrograms] Extrayendo texto de', pdf.numPages, 'páginas...')

        for (let i = 1; i <= pdf.numPages; i++) {
            try {
                const page = await pdf.getPage(i)
                const textContent = await page.getTextContent()
                const pageText = textContent.items.map((item: any) => item.str).join(' ')
                fullText += pageText + '\\n'
            } catch (pageErr) {
                console.warn(`[SyntheticPrograms] Error en página ${i}:`, pageErr)
            }
        }

        console.log('[SyntheticPrograms] Extracción completada. Caracteres:', fullText.length)
        return fullText
    }

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFile) {
            alert('Por favor selecciona un archivo.')
            return
        }

        // Check if phase already exists
        if (programs.some(p => p.phase === newProgram.phase)) {
            if (!confirm(`Ya existe un documento cargado para la Fase ${newProgram.phase}. ¿Deseas reemplazarlo? (El sistema lo sobreescribirá)`)) {
                return
            }
        }

        setUploading(true)
        try {
            // 1. Extract Text
            const extractedText = await extractText(selectedFile)

            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error('No se pudo extraer texto del PDF. Asegúrate de que no sea un documento escaneado solo con imágenes.')
            }

            // 2. Upload File to Storage
            const fileExt = selectedFile.name.split('.').pop()
            const fileName = `Fase_${newProgram.phase}_${Date.now()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('synthetic-programs')
                .upload(filePath, selectedFile)

            if (uploadError) throw uploadError

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('synthetic-programs')
                .getPublicUrl(filePath)

            // 3. Upsert Metadata into Table (Replace if phase exists)
            const { error: upsertError } = await supabase
                .from('synthetic_programs_pdfs')
                .upsert({
                    phase: newProgram.phase,
                    file_name: selectedFile.name,
                    file_url: publicUrl,
                    extracted_text: extractedText
                }, { onConflict: 'phase' }) // Explicitly overide based on unique phase constraint

            if (upsertError) throw upsertError

            alert(`Programa Sintético de la Fase ${newProgram.phase} subido y analizado correctamente.`)
            setSelectedFile(null)
            fetchPrograms()
        } catch (error: any) {
            console.error('Error uploading synthetic program:', error)
            alert('Error al subir programa sintético: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id: string, phase: number) => {
        if (!confirm(`¿Estás seguro de eliminar el Programa Sintético de la Fase ${phase}? La Inteligencia Artificial dejará de tener este contexto oficial.`)) return

        try {
            const { error } = await supabase
                .from('synthetic_programs_pdfs')
                .delete()
                .eq('id', id)

            if (error) throw error

            setPrograms(prev => prev.filter(p => p.id !== id))
        } catch (error: any) {
            alert('Error al eliminar: ' + error.message)
        }
    }

    const filteredPrograms = programs.filter(p => {
        const matchesSearch = p.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.phase.toString().includes(searchTerm)
        return matchesSearch
    })

    const getPhaseLabel = (phase: number) => {
        switch (phase) {
            case 1: return 'Fase 1 (Inicial)'
            case 2: return 'Fase 2 (Preescolar)'
            case 3: return 'Fase 3 (1° y 2° Primaria)'
            case 4: return 'Fase 4 (3° y 4° Primaria)'
            case 5: return 'Fase 5 (5° y 6° Primaria)'
            case 6: return 'Fase 6 (Secundaria)'
            default: return `Fase ${phase}`
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Headers Area */}
            <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
                <div>
                    <h2 className="text-2xl font-black text-indigo-950 uppercase italic tracking-tighter flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-indigo-600" />
                        Programas Sintéticos (NEM)
                    </h2>
                    <p className="text-slate-500 font-medium mt-1">Conocimiento base para la Inteligencia Artificial del Programa Analítico.</p>
                </div>
            </div>

            {/* Upload Section */}
            <div className="glass-panel p-8 rounded-[2rem] border-2 border-indigo-50 shadow-xl shadow-indigo-100/20 bg-gradient-to-br from-white to-indigo-50/30">
                <div className="flex items-center space-x-4 mb-8">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                        <Upload className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-indigo-950 uppercase italic tracking-tighter">Subir Documento Oficial</h3>
                        <p className="text-[11px] text-indigo-400 font-black uppercase tracking-widest">Alimentar IA con contexto oficial</p>
                    </div>
                </div>

                <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div className="md:col-span-1">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Fase Educativa</label>
                        <select aria-label="Fase Educativa"
                            value={newProgram.phase}
                            onChange={e => setNewProgram({ phase: parseInt(e.target.value) })}
                            className="input-squishy w-full py-4 text-sm font-bold text-indigo-900 border-indigo-100"
                        >
                            <option value={1}>Fase 1 (Inicial)</option>
                            <option value={2}>Fase 2 (Preescolar)</option>
                            <option value={3}>Fase 3 (Primaria Baja)</option>
                            <option value={4}>Fase 4 (Primaria Media)</option>
                            <option value={5}>Fase 5 (Primaria Alta)</option>
                            <option value={6}>Fase 6 (Secundaria)</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Archivo PDF Oficial</label>
                        <div className="relative">
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <div className="input-squishy w-full py-4 flex items-center justify-between bg-white border-2 border-dashed border-indigo-200 group-hover:border-indigo-400 transition-all font-bold text-sm">
                                <span className={selectedFile ? 'text-indigo-700' : 'text-slate-500'}>
                                    {selectedFile ? selectedFile.name : 'Seleccionar PDF del Programa Sintético...'}
                                </span>
                                {selectedFile ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <PlusIcon className="w-5 h-5 text-indigo-400" />}
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                        <button
                            type="submit"
                            disabled={uploading || !selectedFile}
                            className={`w-full btn-tactile py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex justify-center items-center space-x-2 ${uploading ? 'bg-slate-400' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-200'}`}
                        >
                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            <span>{uploading ? 'Procesando...' : 'Subir'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* List Section */}
            <div className="glass-panel rounded-[2rem] overflow-hidden shadow-2xl border-white/40">
                <div className="p-8 border-b border-indigo-50/50 flex justify-between items-center bg-white/50">
                    <div className="flex items-center space-x-4">
                        <h3 className="text-xl font-black text-indigo-950 uppercase italic tracking-tighter">Fases Integradas a la IA</h3>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar por fase o archivo..."
                                className="input-squishy pl-12 py-3 text-xs w-64"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="p-20 flex flex-col items-center justify-center text-slate-500">
                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                            <p className="font-black uppercase text-[11px] tracking-widest italic">Cargando base de conocimientos...</p>
                        </div>
                    ) : filteredPrograms.length === 0 ? (
                        <div className="p-20 text-center text-slate-500">
                            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="font-bold">No hay Programas Sintéticos cargados en el sistema.</p>
                            <p className="text-sm mt-2">Sube los PDFs para que la IA tenga contexto oficial.</p>
                        </div>
                    ) : (
                        <div className="table-scroll">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-indigo-50/30 text-[11px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-50">
                                    <th className="px-8 py-5">Fase</th>
                                    <th className="px-8 py-5">Archivo Origen</th>
                                    <th className="px-8 py-5">Fecha Alta</th>
                                    <th className="px-8 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50/50">
                                {filteredPrograms.map(program => (
                                    <tr key={program.id} className="hover:bg-indigo-50/20 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-lg font-black text-indigo-900 leading-tight block">Fase {program.phase}</span>
                                                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mt-1">
                                                    {getPhaseLabel(program.phase).replace(`Fase ${program.phase} (`, '').replace(')', '')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center">
                                                <div className="w-8 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-400 mr-3 shadow-inner border border-indigo-100 flex-shrink-0">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <p className="font-bold text-slate-700 truncate max-w-xs">{program.file_name}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-[11px] font-bold text-slate-500">
                                            {new Date(program.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <a
                                                    href={program.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-3 bg-white border border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                    title="Ver PDF"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </a>
                                                <button
                                                    onClick={() => handleDelete(program.id, program.phase)}
                                                    className="p-3 bg-white border border-rose-100 rounded-xl text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                                    title="Eliminar Contexto"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Inline PlusIcon for less imports
const PlusIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
)
