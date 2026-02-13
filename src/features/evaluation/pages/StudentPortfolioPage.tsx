import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    Plus,
    Image as ImageIcon,
    FileText,
    Search,
    User,
    ArrowLeft,
    ExternalLink,
    Sparkles,
    LayoutGrid,
    Calendar,
    ChevronRight,
    Camera
} from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'
import { UploadEvidenceModal } from '../components/UploadEvidenceModal'

interface Student {
    id: string
    full_name: string
    group_name: string
}

interface Evidence {
    id: string
    title: string
    description: string
    file_url: string
    file_type: string
    category: string
    created_at: string
}

export const StudentPortfolioPage = () => {
    const { data: tenant } = useTenant()
    const [students, setStudents] = useState<Student[]>([])
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

    useEffect(() => {
        if (tenant) fetchStudents()
    }, [tenant])

    useEffect(() => {
        if (selectedStudent) fetchEvidence(selectedStudent.id)
    }, [selectedStudent])

    const fetchStudents = async () => {
        try {
            const { data, error } = await supabase
                .from('students')
                .select(`
                    id, 
                    first_name,
                    last_name_paternal,
                    last_name_maternal,
                    group:groups (name)
                `)
                .eq('tenant_id', tenant?.id)
                .order('first_name')

            if (error) throw error
            const formatted = data.map((s: any) => ({
                id: s.id,
                full_name: `${s.first_name} ${s.last_name_paternal} ${s.last_name_maternal || ''}`,
                group_name: s.group?.name || 'Sin grupo'
            }))
            setStudents(formatted)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchEvidence = async (studentId: string) => {
        const { data } = await supabase
            .from('evidence_portfolio')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
        setEvidence(data || [])
    }

    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.group_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (selectedStudent) {
        return (
            <div className="min-h-screen bg-[#f8fafc] pb-20">
                {/* Header Section */}
                <div className="max-w-7xl mx-auto px-6 pt-12">
                    <button
                        onClick={() => setSelectedStudent(null)}
                        className="flex items-center text-indigo-600 font-black uppercase text-[10px] tracking-[0.3em] mb-8 hover:translate-x-1 transition-transform"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Alumnos
                    </button>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                        <div className="flex items-center space-x-6">
                            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-100 border-4 border-white">
                                <User className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none mb-2">{selectedStudent.full_name}</h1>
                                <div className="flex items-center space-x-4">
                                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">{selectedStudent.group_name}</span>
                                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest flex items-center">
                                        <Sparkles className="w-3 h-3 mr-1.5" /> Portafolio Activo
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center group"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            <Camera className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />
                            Registrar Evidencia
                        </button>
                    </div>

                    {/* Evidence Grid */}
                    {evidence.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 shadow-sm animate-in fade-in duration-700">
                            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-6">
                                <ImageIcon className="w-10 h-10 text-gray-200" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Sin evidencias</h3>
                            <p className="text-gray-400 text-sm font-medium mt-1">Este alumno no tiene trabajos registrados.</p>
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="mt-8 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:text-indigo-700 underline underline-offset-4"
                            >
                                Subir primer trabajo ahora
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-8 duration-700">
                            {evidence.map((item) => (
                                <div key={item.id} className="group bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-xl shadow-indigo-50/50 hover:shadow-2xl hover:shadow-indigo-100 transition-all hover:-translate-y-2">
                                    <div className="aspect-[4/5] bg-gray-50 relative overflow-hidden">
                                        {item.file_type === 'IMAGE' ? (
                                            <img src={item.file_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                                <FileText className="w-16 h-16 mb-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Documento PDF</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                            <a
                                                href={item.file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="w-12 h-12 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center hover:bg-white hover:text-indigo-600 transition-all self-end"
                                            >
                                                <ExternalLink className="w-5 h-5" />
                                            </a>
                                        </div>
                                        <div className="absolute top-4 left-4">
                                            <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black text-gray-900 uppercase tracking-widest shadow-lg">
                                                {item.category === 'CLASSWORK' ? 'Trabajo' : item.category === 'PROJECT' ? 'Proyecto' : 'Examen'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <div className="flex items-center text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">
                                            <Calendar className="w-3 h-3 mr-1.5" />
                                            {new Date(item.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                                        </div>
                                        <h4 className="font-black text-gray-900 text-lg leading-tight mb-2 group-hover:text-indigo-600 transition-colors uppercase tracking-tighter">{item.title}</h4>
                                        <p className="text-xs text-gray-500 font-medium line-clamp-2 leading-relaxed">{item.description || 'Sin descripción adicional.'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <UploadEvidenceModal
                    isOpen={isUploadModalOpen}
                    onClose={() => setIsUploadModalOpen(false)}
                    studentId={selectedStudent.id}
                    onSuccess={() => {
                        fetchEvidence(selectedStudent.id)
                        alert('¡Evidencia guardada exitosamente!')
                    }}
                />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20">
            <div className="max-w-7xl mx-auto px-6 pt-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
                    <div>
                        <div className="flex items-center space-x-2 text-indigo-600 font-black uppercase text-[10px] tracking-[0.3em] mb-3">
                            <LayoutGrid className="w-4 h-4" />
                            <span>Galería de Avances</span>
                        </div>
                        <h1 className="text-6xl font-black text-gray-900 tracking-tight leading-none">
                            Portafolios <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Digitales</span>
                        </h1>
                    </div>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                        <input
                            type="text"
                            placeholder="Buscar alumno o grado..."
                            className="w-full pl-16 pr-8 py-5 rounded-[2rem] border-2 border-transparent bg-white shadow-xl shadow-indigo-50/50 focus:border-indigo-500 focus:ring-0 transition-all font-bold text-gray-900 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl mb-4"></div>
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Sincronizando Alumnos...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredStudents.map((student) => (
                            <div
                                key={student.id}
                                onClick={() => setSelectedStudent(student)}
                                className="group bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-indigo-50/40 hover:shadow-2xl hover:shadow-indigo-100 transition-all cursor-pointer flex flex-col items-center text-center animate-in zoom-in-95 duration-500"
                            >
                                <div className="w-20 h-20 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                                    <User className="w-10 h-10" />
                                </div>
                                <h3 className="font-black text-gray-900 text-lg group-hover:text-indigo-600 transition-colors uppercase tracking-tighter leading-tight mb-2">
                                    {student.full_name}
                                </h3>
                                <div className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">
                                    <LayoutGrid className="w-3 h-3 mr-1.5" />
                                    {student.group_name}
                                </div>

                                <div className="w-full pt-6 border-t border-gray-50 flex items-center justify-between text-indigo-600 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                    <span className="font-black uppercase text-[9px] tracking-widest">Ver Portafolio</span>
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
