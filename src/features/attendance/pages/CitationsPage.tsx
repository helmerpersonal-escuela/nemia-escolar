import { useState, useEffect } from 'react'
import {
    Plus,
    Search,
    Calendar as CalendarIcon,
    Clock,
    User,
    ChevronRight,
    FileText,
    CheckCircle2,
    AlertCircle,
    Printer,
    MoreVertical,
    X,
    Loader2
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { CitationModal } from '../../dashboard/components/roles/CitationModal'

interface Citation {
    id: string
    student_id: string
    reason: string
    meeting_date: string
    meeting_time: string
    status: 'PENDING' | 'SENT' | 'ATTENDED' | 'CANCELLED'
    notes?: string
    created_at: string
    student: {
        first_name: string
        last_name_paternal: string
        last_name_maternal: string
        group: {
            grade: string
            section: string
        }
    }
}

export const CitationsPage = () => {
    const { data: tenant } = useTenant()
    const [citations, setCitations] = useState<Citation[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)

    useEffect(() => {
        if (tenant?.id) {
            fetchCitations()
        }
    }, [tenant?.id])

    const fetchCitations = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('student_citations')
            .select(`
                *,
                student:students (
                    first_name,
                    last_name_paternal,
                    last_name_maternal,
                    group:groups (grade, section)
                )
            `)
            .eq('tenant_id', tenant?.id)
            .order('meeting_date', { ascending: true })

        if (data) setCitations(data as any[])
        setLoading(false)
    }

    const filteredCitations = citations.filter(c =>
        `${c.student.first_name} ${c.student.last_name_paternal}`.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-amber-100 text-amber-700'
            case 'SENT': return 'bg-blue-100 text-blue-700'
            case 'ATTENDED': return 'bg-emerald-100 text-emerald-700'
            case 'CANCELLED': return 'bg-rose-100 text-rose-700'
            default: return 'bg-slate-100 text-slate-700'
        }
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Módulo de Citatorios</h1>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">Gestión de Citas con Padres de Familia</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-105 transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest"
                >
                    <Plus className="w-4 h-4" /> Generar Citatorio
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendientes</p>
                        <p className="text-2xl font-black text-slate-800">{citations.filter(c => c.status === 'PENDING').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                        <CalendarIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Próximas Citas</p>
                        <p className="text-2xl font-black text-slate-800">{citations.filter(c => c.status === 'SENT').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atendidos Hoy</p>
                        <p className="text-2xl font-black text-slate-800">{citations.filter(c => c.status === 'ATTENDED').length}</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                            type="text"
                            placeholder="Buscar por alumno..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 rounded-xl bg-slate-50 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-100 transition-all">Todos</button>
                        <button className="px-4 py-2 rounded-xl bg-slate-50 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-100 transition-all">Hoy</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Alumno</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Hora</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredCitations.map(citation => (
                                <tr key={citation.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                                                {citation.student.first_name[0]}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-700 text-sm">{citation.student.first_name} {citation.student.last_name_paternal}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{citation.student.group.grade}° "{citation.student.group.section}"</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <CalendarIcon className="w-3 h-3" />
                                                <span className="text-xs font-bold">{new Date(citation.meeting_date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Clock className="w-3 h-3" />
                                                <span className="text-[10px] font-bold">{citation.meeting_time.slice(0, 5)} hrs</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <p className="text-xs font-medium text-slate-600 line-clamp-2 max-w-xs">{citation.reason}</p>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusColor(citation.status)}`}>
                                            {citation.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button className="p-2 rounded-xl border border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
                                                <Printer className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 rounded-xl border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {loading && (
                        <div className="p-20 flex flex-col items-center justify-center text-slate-300">
                            <Loader2 className="w-8 h-8 animate-spin mb-4" />
                            <p className="text-xs font-black uppercase tracking-widest">Cargando citatorios...</p>
                        </div>
                    )}
                    {!loading && filteredCitations.length === 0 && (
                        <div className="p-20 text-center">
                            <FileText className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold text-sm uppercase">No se encontraron citatorios</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Citation Modal */}
            <CitationModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={fetchCitations}
            />
        </div>
    )
}
