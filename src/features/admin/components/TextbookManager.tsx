import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    Book,
    Upload,
    Trash2,
    Plus,
    FileText,
    Search,
    Filter,
    Loader2
} from 'lucide-react'

interface Textbook {
    id: string
    title: string
    level: string
    grade: number
    field_of_study: string
    file_url: string
    created_at: string
}

export const TextbookManager = () => {
    const [textbooks, setTextbooks] = useState<Textbook[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterLevel, setFilterLevel] = useState('ALL')

    const [newBook, setNewBook] = useState({
        title: '',
        level: 'SECUNDARIA',
        grade: 1,
        field_of_study: ''
    })
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    useEffect(() => {
        fetchTextbooks()
    }, [])

    const fetchTextbooks = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('textbooks')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setTextbooks(data || [])
        } catch (error: any) {
            console.error('Error fetching textbooks:', error)
            alert('Error al cargar libros: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFile || !newBook.title) {
            alert('Por favor selecciona un archivo y asigna un título.')
            return
        }

        setUploading(true)
        try {
            // 1. Upload File to Storage
            const fileExt = selectedFile.name.split('.').pop()
            const fileName = `${newBook.level}/${newBook.grade}/${Date.now()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('textbooks')
                .upload(filePath, selectedFile)

            if (uploadError) throw uploadError

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('textbooks')
                .getPublicUrl(filePath)

            // 2. Insert Metadata into Table
            const { error: insertError } = await supabase
                .from('textbooks')
                .insert({
                    title: newBook.title,
                    level: newBook.level,
                    grade: newBook.grade,
                    field_of_study: newBook.field_of_study,
                    file_url: publicUrl
                })

            if (insertError) throw insertError

            alert('Libro subido correctamente.')
            setNewBook({ title: '', level: 'SECUNDARIA', grade: 1, field_of_study: '' })
            setSelectedFile(null)
            fetchTextbooks()
        } catch (error: any) {
            console.error('Error uploading textbook:', error)
            alert('Error al subir libro: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id: string, fileUrl: string) => {
        if (!confirm('¿Estás seguro de eliminar este libro?')) return

        try {
            // Extract path from URL to delete from storage if needed
            // For now, just delete from table
            const { error } = await supabase
                .from('textbooks')
                .delete()
                .eq('id', id)

            if (error) throw error

            setTextbooks(prev => prev.filter(b => b.id !== id))
        } catch (error: any) {
            alert('Error al eliminar: ' + error.message)
        }
    }

    const filteredBooks = textbooks.filter(b => {
        const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.field_of_study.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesLevel = filterLevel === 'ALL' || b.level === filterLevel
        return matchesSearch && matchesLevel
    })

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Upload Section */}
            <div className="glass-panel p-8 rounded-[2rem] border-2 border-indigo-50 shadow-xl shadow-indigo-100/20">
                <div className="flex items-center space-x-4 mb-8">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                        <Upload className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-indigo-950 uppercase italic tracking-tighter">Subir Nuevo Libro</h3>
                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Repositorio Central de PDFs</p>
                    </div>
                </div>

                <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Título del Libro</label>
                        <input
                            value={newBook.title}
                            onChange={e => setNewBook({ ...newBook, title: e.target.value })}
                            className="input-squishy w-full"
                            placeholder="Ej: Saberes y Pensamiento Científico"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nivel</label>
                        <select
                            value={newBook.level}
                            onChange={e => setNewBook({ ...newBook, level: e.target.value })}
                            className="input-squishy w-full"
                        >
                            <option value="PRIMARIA">PRIMARIA</option>
                            <option value="SECUNDARIA">SECUNDARIA</option>
                            <option value="TELESECUNDARIA">TELESECUNDARIA</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Grado</label>
                        <select
                            value={newBook.grade}
                            onChange={e => setNewBook({ ...newBook, grade: parseInt(e.target.value) })}
                            className="input-squishy w-full"
                        >
                            {[1, 2, 3, 4, 5, 6].map(g => (
                                <option key={g} value={g}>{g}° Año</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Campo Formativo</label>
                        <input
                            value={newBook.field_of_study}
                            onChange={e => setNewBook({ ...newBook, field_of_study: e.target.value })}
                            className="input-squishy w-full"
                            placeholder="Ej: Lenguajes"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Archivo PDF</label>
                        <div className="relative">
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <div className="input-squishy w-full flex items-center justify-between bg-white border-2 border-dashed border-indigo-100 group-hover:border-indigo-400 transition-all">
                                <span className="text-slate-500 truncate">{selectedFile ? selectedFile.name : 'Seleccionar PDF...'}</span>
                                <Plus className="w-5 h-5 text-indigo-400" />
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={uploading || !selectedFile}
                            className={`btn-tactile px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center space-x-2 ${uploading ? 'bg-slate-400' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-200'}`}
                        >
                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            <span>{uploading ? 'Subiendo...' : 'Publicar Libro'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* List Section */}
            <div className="glass-panel rounded-[2rem] overflow-hidden shadow-2xl border-white/40">
                <div className="p-8 border-b border-indigo-50/50 flex justify-between items-center bg-white/50">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
                            <Book className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black text-indigo-950 uppercase italic tracking-tighter">Inventario de Libros</h3>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar libros..."
                                className="input-squishy pl-12 py-3 text-xs w-64"
                            />
                        </div>
                        <select
                            value={filterLevel}
                            onChange={e => setFilterLevel(e.target.value)}
                            className="input-squishy py-3 text-xs"
                        >
                            <option value="ALL">TODOS LOS NIVELES</option>
                            <option value="PRIMARIA">PRIMARIA</option>
                            <option value="SECUNDARIA">SECUNDARIA</option>
                            <option value="TELESECUNDARIA">TELESECUNDARIA</option>
                        </select>
                    </div>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                            <p className="font-black uppercase text-[10px] tracking-widest italic">Sincronizando Archivos...</p>
                        </div>
                    ) : filteredBooks.length === 0 ? (
                        <div className="p-20 text-center text-slate-400">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="font-bold">No se encontraron libros en el repositorio.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-indigo-50/30 text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-50">
                                    <th className="px-8 py-5">Título / Campo</th>
                                    <th className="px-8 py-5">Nivel & Grado</th>
                                    <th className="px-8 py-5">Fecha Subida</th>
                                    <th className="px-8 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50/50">
                                {filteredBooks.map(book => (
                                    <tr key={book.id} className="hover:bg-indigo-50/20 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center">
                                                <div className="w-10 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-400 mr-4 shadow-inner border border-indigo-100">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-indigo-950 truncate max-w-xs uppercase italic tracking-tighter">{book.title}</p>
                                                    <p className="text-[10px] font-bold text-indigo-400 uppercase mt-0.5">{book.field_of_study || 'General'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="px-3 py-1.5 bg-white border border-indigo-100 rounded-full text-[9px] font-black text-indigo-600 shadow-sm uppercase tracking-widest">
                                                {book.level} - {book.grade}° AÑO
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-[11px] font-bold text-slate-500">
                                            {new Date(book.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <a
                                                    href={book.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-3 bg-white border border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </a>
                                                <button
                                                    onClick={() => handleDelete(book.id, book.file_url)}
                                                    className="p-3 bg-white border border-rose-100 rounded-xl text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
